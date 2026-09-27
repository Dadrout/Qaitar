import type { CaseAnalysis, CaseState } from "../types/qaitar.ts";
import { getMessages, type Locale } from "./i18n/index.ts";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const MAX_FILES = 6;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function resolveUploadType(file: { name: string; type: string }) {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "";
}

export function validateProblemInput(problemType: CaseAnalysis["caseType"] | null, description: string) {
  if (!problemType) return { ok: false as const, error: "Выберите тип проблемы" };
  if (problemType === "other" && !description.trim()) {
    return { ok: false as const, error: "Опишите проблему своими словами" };
  }
  return { ok: true as const };
}

const transitions: Record<CaseState, readonly CaseState[]> = {
  NEW_CASE: ["FILES_UPLOADED"],
  FILES_UPLOADED: ["DOCUMENTS_ANALYZED", "NEW_CASE"],
  DOCUMENTS_ANALYZED: ["CASE_CONFIRMED", "FILES_UPLOADED"],
  CASE_CONFIRMED: ["LEGAL_SEARCH_COMPLETED", "DOCUMENTS_ANALYZED"],
  LEGAL_SEARCH_COMPLETED: ["LEGAL_BASIS_FOUND", "CASE_CONFIRMED"],
  LEGAL_BASIS_FOUND: ["CLAIM_READY", "CASE_CONFIRMED"],
  CLAIM_READY: ["CLAIM_GENERATED"],
  CLAIM_GENERATED: ["WAITING_FOR_RESPONSE"],
  WAITING_FOR_RESPONSE: ["SELLER_RESPONSE_UPLOADED", "RESOLVED"],
  SELLER_RESPONSE_UPLOADED: ["SELLER_ACCEPTED", "SELLER_REJECTED", "WAITING_FOR_RESPONSE"],
  SELLER_ACCEPTED: ["RESOLVED"],
  SELLER_REJECTED: ["ESCALATION_READY"],
  ESCALATION_READY: ["RESOLVED", "WAITING_FOR_RESPONSE"],
  RESOLVED: [],
};

export function validateUpload(file: { name: string; type: string; size: number }, locale: Locale = "ru") {
  const copy = getMessages(locale).newCase.uploadValidation;
  if (!ALLOWED_MIME_TYPES.has(resolveUploadType(file))) {
    return { ok: false as const, error: copy.fileFormat };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { ok: false as const, error: copy.fileSize };
  }
  if (file.size <= 0) {
    return { ok: false as const, error: copy.fileEmpty };
  }
  return { ok: true as const };
}

export function selectUploadBatch<T extends { name: string; type: string; size: number }>(
  current: T[],
  incoming: T[],
  locale: Locale = "ru",
) {
  const accepted: T[] = [];
  const errors: string[] = [];

  for (const file of incoming) {
    const validation = validateUpload(file, locale);
    if (validation.ok) accepted.push(file);
    else errors.push(`${file.name}: ${validation.error}`);
  }

  const availableSlots = Math.max(0, MAX_FILES - current.length);
  if (accepted.length > availableSlots) {
    errors.push(getMessages(locale).newCase.uploadValidation.maxFiles.replace("{count}", String(MAX_FILES)));
  }

  return {
    files: [...current, ...accepted.slice(0, availableSlots)],
    error: errors.length ? errors.join(". ") : null,
  };
}

export function canTransition(from: string, to: string): boolean {
  if (!(from in transitions)) return false;
  return transitions[from as CaseState].includes(to as CaseState);
}

export function assertTransition(from: CaseState, to: CaseState): CaseState {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid case transition: ${from} -> ${to}`);
  }
  return to;
}

export function sanitizeFileName(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()!.toLowerCase()}` : "";
  const stem = name.replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-");
  return `${stem.slice(0, 80) || "evidence"}${extension}`;
}
