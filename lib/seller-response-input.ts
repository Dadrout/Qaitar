import { SellerResponseJsonInputSchema, type SellerResponseAnalysisOutput } from "./ai/schemas.ts";
import { getMessages, type Locale } from "./i18n/index.ts";
import { resolveUploadType, validateUpload } from "./workflow.ts";
import type { CaseAnalysis, OfficialActionPlan, QaitarCase, SellerResponseAnalysis } from "../types/qaitar.ts";

export type SellerResponseDraft =
  | { mode: "file"; file: File | null }
  | { mode: "text"; text: string }
  | { mode: "no_response"; claimSentAt: string; claimReceivedAt: string; receiptVerified: boolean };

export type SellerResponseDrafts = {
  file: Extract<SellerResponseDraft, { mode: "file" }>;
  text: Extract<SellerResponseDraft, { mode: "text" }>;
  no_response: Extract<SellerResponseDraft, { mode: "no_response" }>;
};

export function emptySellerResponseDrafts(claimSentAt = ""): SellerResponseDrafts {
  return {
    file: { mode: "file", file: null },
    text: { mode: "text", text: "" },
    no_response: { mode: "no_response", claimSentAt, claimReceivedAt: "", receiptVerified: false },
  };
}

export function saveSellerResponseDraft(drafts: SellerResponseDrafts, draft: SellerResponseDraft): SellerResponseDrafts {
  return { ...drafts, [draft.mode]: draft } as SellerResponseDrafts;
}

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateClaimSentDate(value: string, now: Date = new Date()) {
  if (!validCalendarDate(value) || !Number.isFinite(now.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return value <= `${get("year")}-${get("month")}-${get("day")}`;
}

export function isClaimSentConfirmed(state: QaitarCase["state"], savedDate: string | null, draftDate: string) {
  return state === "WAITING_FOR_RESPONSE" && Boolean(savedDate) && savedDate === draftDate;
}

export function validateSellerResponseDraft(draft: SellerResponseDraft, locale: Locale = "ru", now: Date = new Date()): { ok: true } | { ok: false; error: string } {
  const errors = getMessages(locale).seller.validation;
  if (draft.mode === "file") {
    if (!draft.file) return { ok: false, error: errors.fileRequired };
    const result = normalizeSellerResponseFile(draft.file);
    if (result.ok) return { ok: true };
    const fileError = {
      "Этот формат не поддерживается": errors.fileFormat,
      "Файл больше 10 МБ": errors.fileSize,
      "Файл пуст": errors.fileEmpty,
    }[result.error];
    return { ok: false, error: fileError ?? errors.fileRequired };
  }
  if (draft.mode === "text") return draft.text.trim().length >= 3 ? { ok: true } : { ok: false, error: errors.textRequired };
  if (!draft.claimSentAt) return { ok: false, error: errors.sentRequired };
  if (!validateClaimSentDate(draft.claimSentAt, now)) return { ok: false, error: errors.sentInvalid };
  if (draft.claimReceivedAt && !validCalendarDate(draft.claimReceivedAt)) return { ok: false, error: errors.receivedInvalid };
  if (draft.claimReceivedAt && draft.claimReceivedAt < draft.claimSentAt) return { ok: false, error: errors.chronology };
  if (draft.receiptVerified && !draft.claimReceivedAt) return { ok: false, error: errors.receivedRequired };
  if (draft.claimReceivedAt && !draft.receiptVerified) return { ok: false, error: errors.verifyReceipt };
  if (draft.receiptVerified && !hasSellerResponseDeadlineElapsed(draft.claimReceivedAt, now)) return { ok: false, error: errors.deadline };
  return { ok: true };
}

export function createSellerResponseRequest(draft: SellerResponseDraft, analysis: CaseAnalysis | null, locale: Locale, demo = false): RequestInit {
  if (draft.mode === "file") {
    if (!draft.file) throw new Error("Seller response file is missing");
    const formData = new FormData();
    formData.set("file", draft.file);
    if (analysis) formData.set("analysis", JSON.stringify(analysis));
    formData.set("demo", String(demo));
    formData.set("locale", locale);
    return { method: "POST", body: formData };
  }
  if (!analysis) throw new Error("Case analysis is missing");
  const payload = draft.mode === "text"
    ? { mode: "text" as const, text: draft.text.trim(), analysis, locale }
    : { mode: "no_response" as const, claimSentAt: draft.claimSentAt, ...(draft.receiptVerified ? { claimReceivedAt: draft.claimReceivedAt } : {}), analysis, locale };
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}

export function sellerResponseNextState(response: Pick<SellerResponseAnalysis, "responseType">, plan: Pick<OfficialActionPlan, "status"> | null): QaitarCase["state"] {
  if (response.responseType === "accepted") return "SELLER_ACCEPTED";
  return (response.responseType === "rejected" || response.responseType === "no_response") && plan?.status === "ready" ? "ESCALATION_READY" : "SELLER_REJECTED";
}

export function normalizeSellerResponseFile(file: { name: string; type: string; size: number }) {
  const validation = validateUpload(file);
  if (!validation.ok) return validation;
  return { ok: true as const, mimeType: resolveUploadType(file) };
}

export function parseSellerResponseJson(input: unknown) {
  return SellerResponseJsonInputSchema.parse(input);
}

export function hasSellerResponseDeadlineElapsed(claimReceivedAt: string, now: Date = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(claimReceivedAt) || !Number.isFinite(now.getTime())) return false;
  const [year, month, day] = claimReceivedAt.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== claimReceivedAt) return false;
  // Kazakhstan observes UTC+05:00 on the dates supported by this workflow.
  // Counting starts the day after receipt; the seller can reply through day ten.
  const deadlineUtc = date.getTime() + 11 * 24 * 60 * 60 * 1_000 - 5 * 60 * 60 * 1_000;
  return now.getTime() >= deadlineUtc;
}

export function buildUnverifiedNoResponseAnalysis(locale: Locale): SellerResponseAnalysisOutput {
  const summary = {
    ru: "Ответ продавца не получен; дата получения претензии продавцом не подтверждена.",
    kk: "Сатушының жауабы алынбады; сатушының талапты алған күні расталмаған.",
    en: "No seller reply was received; the date the seller received the claim is unverified.",
  }[locale];
  return { responseType: "no_response", sellerReason: null, summary, newFacts: [], requiresLegalReview: true };
}

export function buildNoResponseAnalysis(locale: Locale): SellerResponseAnalysisOutput {
  const summary = {
    ru: "Продавец не ответил на письменную претензию в установленный срок.",
    kk: "Сатушы жазбаша талапқа белгіленген мерзімде жауап бермеді.",
    en: "The seller did not respond to the written claim within the required period.",
  }[locale];
  return {
    responseType: "no_response",
    sellerReason: null,
    summary,
    newFacts: [],
    requiresLegalReview: true,
  };
}
