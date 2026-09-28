import type { LegalChunk } from "../../types/qaitar.ts";
import { getServerSupabase, isSupabaseConfigured } from "../supabase/server.ts";

type LegalRow = {
  id: string;
  law_name: string;
  article: string;
  section: string | null;
  text: string;
  language: string;
  source_url: string;
  score: number;
};

function isOfficialSource(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return hostname === "adilet.zan.kz" || hostname === "law.gov.kz" || hostname === "gov.kz" || hostname.endsWith(".gov.kz");
  } catch {
    return false;
  }
}

export function filterOfficialLegalChunks(rows: LegalRow[]): LegalChunk[] {
  return rows.filter((row) => isOfficialSource(row.source_url)).map((row) => ({
    id: row.id,
    lawName: row.law_name,
    article: row.article,
    section: row.section,
    text: row.text,
    language: row.language,
    sourceUrl: row.source_url,
    similarity: row.score,
  }));
}

export async function retrieveLegalChunks(query: string, embedding: number[], limit = 6) {
  if (!isSupabaseConfigured()) return [];
  const supabase = getServerSupabase();
  const { data, error } = await supabase.rpc("hybrid_search_legal_chunks", {
    query_text: query,
    query_embedding: embedding,
    match_count: Math.min(Math.max(limit, 3), 6),
  });
  if (error) throw new Error("Правовая база временно недоступна");
  return filterOfficialLegalChunks((data ?? []) as LegalRow[]);
}
