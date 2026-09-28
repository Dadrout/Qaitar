import { GEMINI_EMBEDDING_MODEL, getGeminiClient } from "./gemini.ts";

export async function embedLegalQuery(query: string) {
  const ai = getGeminiClient();
  const response = await ai.models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
    contents: `task: search result | query: ${query}`,
    config: { outputDimensionality: 768 },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values?.length) throw new Error("Не удалось подготовить правовой поиск");
  return values;
}

export async function embedLegalDocument(text: string) {
  const ai = getGeminiClient();
  const response = await ai.models.embedContent({
    model: GEMINI_EMBEDDING_MODEL,
    contents: `title: Официальный правовой материал | text: ${text}`,
    config: { outputDimensionality: 768 },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values?.length) throw new Error("Не удалось создать embedding");
  return values;
}
