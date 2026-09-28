import {
  DocumentAnalysisSchema,
  documentAnalysisJsonSchema,
  type DocumentAnalysis,
} from "./schemas.ts";
import { ThinkingLevel } from "@google/genai";
import { GEMINI_ANALYSIS_FALLBACK_MODEL, GEMINI_ANALYSIS_MODEL, generateStructured } from "./gemini.ts";

export type DocumentInput = {
  name: string;
  mimeType: string;
  base64: string;
};

const prompt = `Проанализируй загруженный документ как доказательство по спору потребителя в Казахстане.
Извлекай только то, что действительно видно. Не угадывай дату, цену, продавца или номер заказа.
Если значение неразборчиво, верни null и заполни unreadableReason.
extractedText должен быть кратким и содержать только фрагменты, важные для дела.
Все даты верни в формате YYYY-MM-DD, валюта по умолчанию KZT.`;

export async function analyzeDocument(input: DocumentInput): Promise<DocumentAnalysis> {
  return generateStructured({
    prompt,
    schema: DocumentAnalysisSchema,
    jsonSchema: documentAnalysisJsonSchema,
    parts: [{ inlineData: { mimeType: input.mimeType, data: input.base64 } }],
    systemInstruction: "Ты аккуратный специалист по разбору документов. Отделяй увиденное от предположений.",
    models: [GEMINI_ANALYSIS_MODEL, GEMINI_ANALYSIS_FALLBACK_MODEL],
    thinkingLevel: ThinkingLevel.MINIMAL,
    thinkingBudget: 0,
    retryDelaysMs: [],
    timeoutMs: 20_000,
    maxOutputTokens: 2_048,
  });
}
