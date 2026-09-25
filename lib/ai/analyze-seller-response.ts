import {
  SellerResponseAnalysisSchema,
  sellerResponseJsonSchema,
  type SellerResponseAnalysisOutput,
} from "./schemas.ts";
import { GEMINI_ANALYSIS_FALLBACK_MODEL, GEMINI_ANALYSIS_MODEL, generateStructured } from "./gemini.ts";
import { responseLanguage, type Locale } from "../i18n/index.ts";
import { ThinkingLevel } from "@google/genai";

export type AnalyzeSellerResponseInput =
  | { mode: "file"; mimeType: string; base64: string; caseSummary: string; locale: Locale }
  | { mode: "text"; text: string; caseSummary: string; locale: Locale };

export async function analyzeSellerResponse(input: AnalyzeSellerResponseInput): Promise<SellerResponseAnalysisOutput> {
  return generateStructured({
    prompt: `Проанализируй ответ продавца в контексте дела: ${input.caseSummary}.
Извлеки тип ответа, дословный смысл причины отказа и новые факты. Не делай правовой вывод:
requiresLegalReview означает только необходимость повторного поиска по проверенной правовой базе.
Пиши на ${responseLanguage(input.locale)} языке, кратко.${input.mode === "text" ? `\nТекст ответа продавца:\n${input.text}` : ""}` ,
    schema: SellerResponseAnalysisSchema,
    jsonSchema: sellerResponseJsonSchema,
    parts: input.mode === "file" ? [{ inlineData: { mimeType: input.mimeType, data: input.base64 } }] : [],
    models: [GEMINI_ANALYSIS_MODEL, GEMINI_ANALYSIS_FALLBACK_MODEL],
    thinkingBudget: 0,
    thinkingLevel: ThinkingLevel.MINIMAL,
    retryDelaysMs: [],
    timeoutMs: 20_000,
    maxOutputTokens: 2_048,
  });
}
