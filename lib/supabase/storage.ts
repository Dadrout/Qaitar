import { randomUUID } from "node:crypto";

import { sanitizeFileName } from "../workflow.ts";
import { getServerSupabase, isSupabaseConfigured } from "./server.ts";

export async function uploadEvidence(caseId: string, file: File) {
  if (!isSupabaseConfigured()) return null;
  const path = `${caseId}/${randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error } = await getServerSupabase().storage
    .from("case-documents")
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw new Error("Не удалось безопасно сохранить файл");
  return path;
}
