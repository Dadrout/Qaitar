import { SellerResponseJsonInputSchema, type SellerResponseAnalysisOutput } from "./ai/schemas.ts";
import type { Locale } from "./i18n/index.ts";
import { resolveUploadType, validateUpload } from "./workflow.ts";

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
