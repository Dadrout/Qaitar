import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import type { ZodType } from "zod";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite";
export const GEMINI_ANALYSIS_MODEL = process.env.GEMINI_ANALYSIS_MODEL ?? "gemini-3.5-flash-lite";
export const GEMINI_ANALYSIS_FALLBACK_MODEL = process.env.GEMINI_ANALYSIS_FALLBACK_MODEL ?? "gemini-3.8-flash";
export const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2";

let client: GoogleGenAI | null = null;

export class AIUnavailableError extends Error {
  constructor() {
    super("AI service is not configured");
    this.name = "AIUnavailableError";
  }
}

const DEFAULT_RETRY_DELAYS_MS = [700, 1_600];

function errorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return null;
  return typeof error.status === "number" ? error.status : null;
}

function isTransientAIError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") return true;
  if (error instanceof Error && error.message === "Некорректный ответ AI") return true;
  const status = errorStatus(error);
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export async function withTransientAIRetry<T>(
  operation: () => Promise<T>,
  delaysMs: number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const delay = delaysMs[attempt];
      if (!isTransientAIError(error) || delay === undefined) throw error;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function withAIModelFallback<T>(
  models: string[],
  operation: (model: string) => Promise<T>,
  retryDelaysMs: number[] = DEFAULT_RETRY_DELAYS_MS,
): Promise<T> {
  let lastError: unknown;
  for (const model of [...new Set(models)]) {
    try {
      return await withTransientAIRetry(() => operation(model), retryDelaysMs);
    } catch (error) {
      if (!isTransientAIError(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export function getAIUserMessage(error: unknown) {
  if (error instanceof AIUnavailableError) {
    return "Сервис анализа не настроен. Проверьте ключ Gemini.";
  }
  if (isTransientAIError(error)) {
    return "Сервис анализа временно перегружен. Подождите немного и повторите попытку.";
  }
  return "Не удалось разобрать документы. Проверьте формат файлов или повторите позже.";
}

export function getSellerResponseUserMessage(error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === "UNSUPPORTED_FILE") {
    return "Не поддерживается формат файла ответа продавца.";
  }
  if (error instanceof Error && error.name === "AbortError") {
    return "Сервис не успел обработать ответ продавца. Повторите попытку.";
  }
  if (error instanceof Error && error.message === "Некорректный ответ AI") {
    return "Не удалось распознать ответ продавца. Повторите попытку.";
  }
  return getAIUserMessage(error);
}

export function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AIUnavailableError();
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export function parseStructuredOutput<T>(text: string, schema: ZodType<T>): T {
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw new Error("Некорректный ответ AI");
  }
}

type GenerateStructuredInput<T> = {
  prompt: string;
  schema: ZodType<T>;
  jsonSchema: Record<string, unknown>;
  parts?: Array<Record<string, unknown>>;
  systemInstruction?: string;
  models?: string[];
  thinkingLevel?: ThinkingLevel;
  thinkingBudget?: number;
  retryDelaysMs?: number[];
  timeoutMs?: number;
  maxOutputTokens?: number;
};

export async function generateStructured<T>({
  prompt,
  schema,
  jsonSchema,
  parts = [],
  systemInstruction,
  models = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL],
  thinkingLevel,
  thinkingBudget,
  retryDelaysMs,
  timeoutMs,
  maxOutputTokens = 8_192,
}: GenerateStructuredInput<T>): Promise<T> {
  const ai = getGeminiClient();
  const response = await withAIModelFallback(
    models,
    (model) => ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [...parts, { text: prompt }] }] as never,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema,
        systemInstruction,
        maxOutputTokens,
        thinkingConfig: model.startsWith("gemini-2.5")
          ? thinkingBudget === undefined ? undefined : { thinkingBudget }
          : thinkingLevel ? { thinkingLevel } : undefined,
        httpOptions: timeoutMs ? { timeout: timeoutMs } : undefined,
      },
    }),
    retryDelaysMs,
  );

  if (!response.text) throw new Error("Некорректный ответ AI");
  return parseStructuredOutput(response.text, schema);
}
