import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { documentEffectiveFrom } from "./legal-corpus-dates.mjs";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");
if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
if (!supabaseSecretKey) throw new Error("Missing SUPABASE_SECRET_KEY");

const corpusPath = fileURLToPath(new URL("../data/legal/consumer-rights.ru.json", import.meta.url));
const chunks = JSON.parse(await readFile(corpusPath, "utf8"));
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const chunk of chunks) {
  const { data: document, error: documentError } = await supabase.from("legal_documents").upsert({
    title: chunk.title,
    language: chunk.language,
    source_url: chunk.sourceUrl,
    effective_from: documentEffectiveFrom(chunks.filter((entry) => entry.title === chunk.title && entry.sourceUrl === chunk.sourceUrl)),
    metadata: { verified: true, ingested_by: "qaitar" },
  }, { onConflict: "title,source_url" }).select("id").single();
  if (documentError) throw documentError;

  const embeddingResponse = await ai.models.embedContent({
    model: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-2",
    contents: `title: ${chunk.title} | article: ${chunk.article} | text: ${chunk.text}`,
    config: { outputDimensionality: 768 },
  });
  const embedding = embeddingResponse.embeddings?.[0]?.values;
  if (!embedding?.length) throw new Error(`Embedding failed for article ${chunk.article}`);

  const { error: chunkError } = await supabase.from("legal_chunks").upsert({
    legal_document_id: document.id,
    law_name: chunk.lawName,
    article: chunk.article,
    section: chunk.section,
    text: chunk.text,
    language: chunk.language,
    source_url: chunk.sourceUrl,
    embedding,
    metadata: { verified: true, effective_from: chunk.effectiveFrom },
  }, { onConflict: "legal_document_id,article,section" });
  if (chunkError) throw chunkError;
}

console.log(`Ingested ${chunks.length} verified legal chunks.`);
