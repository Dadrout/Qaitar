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

test("AI-classified no-response without a verified receipt date cannot produce a ready official plan", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const plan = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: noResponse, recommendation, chunks, locale: "ru", today: new Date("2026-09-25T00:00:00.000Z") });
  assert.equal(plan.status, "manual_verification_required");
  assert.deepEqual(plan.channels, []);
  assert.equal(plan.appealText, null);
  assert.ok(plan.missingInformation.some((item) => /получ.*претензи/i.test(item)));
});

test("an old sent date alone cannot prove seller receipt or produce a ready plan", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const plan = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: noResponse, recommendation, chunks, locale: "ru", claimSentAt: "2026-09-01", today: new Date("2026-09-25T00:00:00.000Z") });
  assert.equal(plan.status, "manual_verification_required");
  assert.deepEqual(plan.channels, []);
  assert.equal(plan.appealText, null);
});

test("a claim received yesterday cannot produce a ready official plan", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const plan = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: noResponse, recommendation, chunks, locale: "ru", verifiedClaimReceivedAt: "2026-09-24", today: new Date("2026-09-25T00:00:00.000Z") });
  assert.equal(plan.status, "manual_verification_required");
  assert.deepEqual(plan.channels, []);
  assert.equal(plan.appealText, null);
});

test("no-response official plan becomes ready only after day ten ends in Kazakhstan", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const before = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: noResponse, recommendation, chunks, locale: "ru", verifiedClaimReceivedAt: "2026-09-01", today: new Date("2026-09-11T18:59:59.000Z") });
  const at = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: noResponse, recommendation, chunks, locale: "ru", verifiedClaimReceivedAt: "2026-09-01", today: new Date("2026-09-11T19:00:00.000Z") });
  assert.equal(before.status, "manual_verification_required");
  assert.equal(at.status, "ready");
  assert.match(at.appealText ?? "", /не ответил.*установленн/i);
  assert.equal(at.missingInformation.some((item) => /получ.*претензи/i.test(item)), false);
  assert.match(at.deadline.explanation, /дата претензии.*не указана/i);
  assert.doesNotMatch(at.deadline.explanation, /2026-09-01/);
});

test("legacy sent-only no-response route returns manual verification, not an elapsed-period assertion", async () => {
  const { POST } = await import("../app/api/seller-response/route.ts");
  const request = new Request("http://localhost/api/seller-response", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "no_response", claimSentAt: "2026-09-01", analysis: caseAnalysisFixture, locale: "ru" }),
  });
  const response = await POST(request);
  assert.equal(response.status, 200);
  const body = await response.json() as { officialActionPlan: { status: string; appealText: string | null }; responseAnalysis: { summary: string } };
  assert.equal(body.officialActionPlan.status, "manual_verification_required");
  assert.equal(body.officialActionPlan.appealText, null);
  assert.doesNotMatch(body.responseAnalysis.summary, /в установленный срок/i);
});

test("no-response route validates the seller receipt date, not an older sent date", async () => {
  const { POST } = await import("../app/api/seller-response/route.ts");
  const request = new Request("http://localhost/api/seller-response", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "no_response", claimSentAt: "2026-08-01", claimReceivedAt: "2099-09-25", analysis: caseAnalysisFixture, locale: "ru" }),
  });
  const response = await POST(request);
  assert.equal(response.status, 400);
  const body = await response.json() as { error: string };
  assert.match(body.error, /ещё не истёк/i);
});

test("restoring a legacy sent-only case does not create a receipt date", async () => {
  const { createEmptyCase, restoreCaseCollection } = await import("../lib/case-history.ts");
  const legacyCase = {
    ...createEmptyCase("legacy-sent-only"),
    claimSentAt: "2026-09-01",
    sellerResponseInput: { mode: "no_response", claimSentAt: "2026-09-01", submittedAt: "2026-09-12T00:00:00.000Z" },
  };
  const restored = restoreCaseCollection(JSON.stringify({ version: 2, activeCaseId: legacyCase.id, cases: [legacyCase] }), "");
  assert.equal(restored.cases[0].claimSentAt, "2026-09-01");
  assert.deepEqual(restored.cases[0].sellerResponseInput, legacyCase.sellerResponseInput);
  assert.equal("claimReceivedAt" in restored.cases[0].sellerResponseInput!, false);
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
