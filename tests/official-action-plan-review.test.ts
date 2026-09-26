import assert from "node:assert/strict";
import test from "node:test";
import corpus from "../data/legal/consumer-rights.ru.json" with { type: "json" };
import type { LegalChunk, LegalRecommendation, SellerResponseAnalysis } from "../types/qaitar.ts";
import { caseAnalysisFixture } from "./fixtures.ts";

const lawUrl = "https://adilet.zan.kz/rus/docs/Z100000274_";
const guideUrl = "https://www.gov.kz/situations/464/intro?lang=ru";
const chunks: LegalChunk[] = [
  { id: "42-4", lawName: "Law", article: "42-4", section: "Claim response", text: "При отказе или отсутствии ответа в течение десяти календарных дней потребитель вправе обратиться в уполномоченный орган.", language: "ru", sourceUrl: lawUrl },
  { id: "42-5", lawName: "Law", article: "42-5", section: "State appeal", text: "Обращение подается не позднее двух месяцев с претензией, ответом продавца и документами по покупке.", language: "ru", sourceUrl: lawUrl },
  { id: "guide", lawName: "Guide", article: "Порядок обращения", section: "Channel", text: "Обращение в Департамент торговли и защиты прав потребителей можно подать через eOtinish.", language: "ru", sourceUrl: guideUrl },
];
const recommendation: LegalRecommendation = {
  status: "legal_basis_found", caseType: "defective_product", title: "Обращение", summary: "Обратитесь в орган.",
  reasoning: "Продавец не ответил.", recommendedAction: "prepare_official_appeal",
  legalBasis: [
    { lawName: "Law", article: "42-4, 42-5", explanation: "Procedure", sourceUrl: lawUrl },
    { lawName: "Guide", article: "Порядок обращения", explanation: "Channel", sourceUrl: guideUrl },
  ], missingInformation: [], confidence: "high",
};
const noResponse: SellerResponseAnalysis = {
  responseType: "no_response", sellerReason: null, summary: "Продавец не ответил.", newFacts: [], requiresLegalReview: true,
};

test("AI-classified no-response without a verified claim date cannot produce a ready official plan", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const plan = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: noResponse, recommendation, chunks, locale: "ru", today: new Date("2026-09-25T00:00:00.000Z") });
  assert.equal(plan.status, "manual_verification_required");
  assert.deepEqual(plan.channels, []);
  assert.equal(plan.appealText, null);
  assert.ok(plan.missingInformation.some((item) => /дата.*претензи/i.test(item)));
});

test("a no-response claim sent yesterday cannot produce a ready official plan", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const plan = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: noResponse, recommendation, chunks, locale: "ru", verifiedClaimSentAt: "2026-09-24", today: new Date("2026-09-25T00:00:00.000Z") });
  assert.equal(plan.status, "manual_verification_required");
  assert.deepEqual(plan.channels, []);
  assert.equal(plan.appealText, null);
});

test("no-response official plan becomes ready exactly at the Kazakhstan ten-day boundary", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const before = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: noResponse, recommendation, chunks, locale: "ru", verifiedClaimSentAt: "2026-09-01", today: new Date("2026-09-10T18:59:59.000Z") });
  const at = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: noResponse, recommendation, chunks, locale: "ru", verifiedClaimSentAt: "2026-09-01", today: new Date("2026-09-10T19:00:00.000Z") });
  assert.equal(before.status, "manual_verification_required");
  assert.equal(at.status, "ready");
  assert.match(at.appealText ?? "", /не ответил.*установленн/i);
  assert.equal(at.missingInformation.some((item) => /дата.*претензи/i.test(item)), false);
  assert.match(at.deadline.explanation, /2026-09-01/);
  assert.doesNotMatch(at.deadline.explanation, /не указана/);
});

test("curated corpus does not assert unsupported effective dates", () => {
  const byArticle = (article: string) => corpus.find((entry) => entry.article === article);
  assert.equal(byArticle("15")?.effectiveFrom, null);
  assert.equal(byArticle("18")?.effectiveFrom, "2020-07-07");
  assert.equal(byArticle("42-4")?.effectiveFrom, "2020-07-07");
  assert.equal(byArticle("42-5")?.effectiveFrom, "2020-07-07");
  assert.equal(corpus.find((entry) => entry.sourceUrl.includes("/situations/753/"))?.effectiveFrom, null);
});

test("a document with differently dated articles has no document-wide effective date", async () => {
  const { documentEffectiveFrom } = await import("../scripts/legal-corpus-dates.mjs");
  assert.equal(documentEffectiveFrom(corpus.filter((entry) => entry.sourceUrl === lawUrl)), null);
  assert.equal(documentEffectiveFrom([{ effectiveFrom: "2020-07-07" }, { effectiveFrom: "2020-07-07" }]), "2020-07-07");
  assert.equal(documentEffectiveFrom([{ effectiveFrom: null }]), null);
});
