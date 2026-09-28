import { DocumentExplanationSchema, documentExplanationJsonSchema } from "./schemas.ts";
import { generateStructured } from "./gemini.ts";
import { responseLanguage, type Locale } from "../i18n/index.ts";

export async function explainDocument(input: { mimeType: string; base64: string; locale?: Locale }) {
  return generateStructured({
    prompt: `Объясни официальный документ на ${responseLanguage(input.locale ?? "ru")} языке простыми словами.
Определи, что это за документ. В important вынеси только видимые даты, сроки, суммы, организации, обязанности, требуемые действия и последствия.
В checklist дай короткие конкретные действия. Ничего не придумывай: если сведений нет, не добавляй их.`,
    schema: DocumentExplanationSchema,
    jsonSchema: documentExplanationJsonSchema,
    parts: [{ inlineData: { mimeType: input.mimeType, data: input.base64 } }],
  });
}
