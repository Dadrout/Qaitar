import assert from "node:assert/strict";
import test from "node:test";

test("accepts supported evidence and rejects unsafe uploads", async () => {
  const workflow = await import("../lib/workflow.ts");
  assert.equal(typeof workflow.validateUpload, "function");

  const validateUpload = workflow.validateUpload as (file: {
    name: string;
    type: string;
    size: number;
  }) => { ok: boolean; error?: string };

  assert.deepEqual(
    validateUpload({ name: "receipt.JPG", type: "image/jpeg", size: 512_000 }),
    { ok: true },
  );
  assert.deepEqual(
    validateUpload({ name: "payload.svg", type: "image/svg+xml", size: 200 }),
    { ok: false, error: "Этот формат не поддерживается" },
  );
  assert.deepEqual(
    validateUpload({ name: "large.pdf", type: "application/pdf", size: 10 * 1024 * 1024 + 1 }),
    { ok: false, error: "Файл больше 10 МБ" },
  );
});

test("reports rejected evidence instead of silently ignoring the selection", async () => {
  const workflow = await import("../lib/workflow.ts");
  assert.equal(typeof workflow.selectUploadBatch, "function");

  const selectUploadBatch = workflow.selectUploadBatch as (
    current: Array<{ name: string; type: string; size: number }>,
    incoming: Array<{ name: string; type: string; size: number }>,
  ) => { files: Array<{ name: string }>; error: string | null };

  const result = selectUploadBatch(
    [{ name: "receipt.jpg", type: "image/jpeg", size: 128 }],
    [
      { name: "contract.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 256 },
      { name: "empty.pdf", type: "application/pdf", size: 0 },
    ],
  );

  assert.deepEqual(result.files.map((file) => file.name), ["receipt.jpg"]);
  assert.match(result.error ?? "", /contract\.docx: Этот формат не поддерживается/);
  assert.match(result.error ?? "", /empty\.pdf: Файл пуст/);
});

test("allows only deterministic case-state transitions", async () => {
  const workflow = await import("../lib/workflow.ts");
  assert.equal(typeof workflow.canTransition, "function");

  const canTransition = workflow.canTransition as (from: string, to: string) => boolean;
  assert.equal(canTransition("NEW_CASE", "FILES_UPLOADED"), true);
  assert.equal(canTransition("FILES_UPLOADED", "DOCUMENTS_ANALYZED"), true);
  assert.equal(canTransition("NEW_CASE", "LEGAL_BASIS_FOUND"), false);
  assert.equal(canTransition("SELLER_REJECTED", "ESCALATION_READY"), true);
});

test("requires a written description only for the other problem category", async () => {
  const { validateProblemInput } = await import("../lib/workflow.ts");
  assert.deepEqual(validateProblemInput("defective_product", ""), { ok: true });
  assert.deepEqual(validateProblemInput("other", ""), { ok: false, error: "Опишите проблему своими словами" });
  assert.deepEqual(validateProblemInput("other", "  Продавец списал оплату дважды  "), { ok: true });
  assert.deepEqual(validateProblemInput(null, "Описание есть"), { ok: false, error: "Выберите тип проблемы" });
});

test("permits only the seller-response workflow transitions", async () => {
  const { canTransition } = await import("../lib/workflow.ts");
  assert.equal(canTransition("WAITING_FOR_RESPONSE", "SELLER_RESPONSE_UPLOADED"), true);
  assert.equal(canTransition("SELLER_RESPONSE_UPLOADED", "SELLER_REJECTED"), true);
  assert.equal(canTransition("SELLER_RESPONSE_UPLOADED", "SELLER_ACCEPTED"), true);
  assert.equal(canTransition("WAITING_FOR_RESPONSE", "ESCALATION_READY"), false);
  assert.equal(canTransition("SELLER_REJECTED", "ESCALATION_READY"), true);
});

test("rejects an actionable official plan without verified sources", async () => {
  const { OfficialActionPlanSchema } = await import("../lib/ai/schemas.ts");
  assert.ok(OfficialActionPlanSchema);
  const result = OfficialActionPlanSchema.safeParse({
    status: "ready",
    title: "Подайте обращение",
    authority: { name: "Департамент", reason: "Рассматривает обращения", sourceUrl: "" },
    channels: [],
    deadline: { label: "До 1 ноября", date: "2026-11-01", explanation: "Срок обращения", sourceUrl: "" },
    steps: [], requiredAttachments: [], legalBasis: [],
    appealText: "Прошу рассмотреть нарушение моих прав.",
    missingInformation: [], confidence: "high",
  });
  assert.equal(result.success, false);
});

test("requires a step and official sources for ready plans", async () => {
  const { OfficialActionPlanSchema } = await import("../lib/ai/schemas.ts");
  assert.ok(OfficialActionPlanSchema);
  const readyPlan = {
    status: "ready",
    title: "Подайте обращение",
    authority: { name: "Департамент", reason: "Рассматривает обращения", sourceUrl: "https://www.gov.kz/department" },
    channels: [{ type: "eotinish", label: "eOtinish", url: "https://eotinish.kz", sourceUrl: "https://www.gov.kz/eotinish" }],
    deadline: { label: "Срок обращения", date: "2026-11-01", explanation: "Указан ведомством", sourceUrl: "https://adilet.zan.kz/rus/docs/Z100000274_" },
    steps: ["Подготовьте документы"], requiredAttachments: [], legalBasis: [],
    appealText: "Прошу рассмотреть нарушение моих прав.",
    missingInformation: [], confidence: "high",
  };
  assert.equal(OfficialActionPlanSchema.safeParse(readyPlan).success, true);
  assert.equal(OfficialActionPlanSchema.safeParse({ ...readyPlan, steps: [] }).success, false);
  assert.equal(OfficialActionPlanSchema.safeParse({ ...readyPlan, channels: [{ ...readyPlan.channels[0], sourceUrl: "https://example.com" }] }).success, false);
  assert.equal(OfficialActionPlanSchema.safeParse({ ...readyPlan, authority: { ...readyPlan.authority, sourceUrl: null } }).success, false);
  assert.equal(OfficialActionPlanSchema.safeParse({ ...readyPlan, deadline: { ...readyPlan.deadline, sourceUrl: null } }).success, false);
});

test("allows unsourced authority and deadline only when manual verification is required", async () => {
  const { OfficialActionPlanSchema } = await import("../lib/ai/schemas.ts");
  assert.ok(OfficialActionPlanSchema);
  const result = OfficialActionPlanSchema.safeParse({
    status: "manual_verification_required",
    title: "Уточните ведомство и срок",
    authority: { name: null, reason: "Требуется проверка", sourceUrl: null },
    channels: [],
    deadline: { label: "Уточните срок", date: null, explanation: "Срок не подтверждён", sourceUrl: null },
    steps: [], requiredAttachments: [], legalBasis: [], appealText: null,
    missingInformation: ["Компетентное ведомство"], confidence: "low",
  });
  assert.equal(result.success, true);
});

test("constrains every official plan source in the provider JSON schema", async () => {
  const { officialActionPlanJsonSchema } = await import("../lib/ai/schemas.ts");
  const authorityUrl = officialActionPlanJsonSchema.properties.authority.properties.sourceUrl.anyOf[0];
  const deadlineUrl = officialActionPlanJsonSchema.properties.deadline.properties.sourceUrl.anyOf[0];
  assert.ok("pattern" in authorityUrl);
  assert.ok("pattern" in deadlineUrl);
  const authoritySource = new RegExp(authorityUrl.pattern);
  const channelSource = new RegExp(officialActionPlanJsonSchema.properties.channels.items.properties.sourceUrl.pattern);
  const deadlineSource = new RegExp(deadlineUrl.pattern);
  const legalSource = new RegExp(officialActionPlanJsonSchema.properties.legalBasis.items.properties.sourceUrl.pattern);
  for (const pattern of [authoritySource, channelSource, deadlineSource, legalSource]) {
    assert.equal(pattern.test("https://www.gov.kz/appeal"), true);
    assert.equal(pattern.test("https://example.com/appeal"), false);
  }
});

test("rejects an authoritative legal recommendation without an official source URL", async () => {
  const schemas = await import("../lib/ai/schemas.ts");
  assert.ok(schemas.LegalRecommendationSchema);

  const result = schemas.LegalRecommendationSchema.safeParse({
    status: "legal_basis_found",
    caseType: "defective_product",
    title: "Есть основания требовать возврат денег",
    summary: "Основание найдено.",
    reasoning: "Товар имеет недостаток.",
    recommendedAction: "send_written_claim",
    legalBasis: [
      {
        lawName: "Закон РК «О защите прав потребителей»",
        article: "15",
        explanation: "Потребитель может выбрать возврат денег.",
        sourceUrl: "",
      },
    ],
    missingInformation: [],
    confidence: "high",
  });

  assert.equal(result.success, false);
});

test("activates cached facts only for the explicit seeded demo", async () => {
  const demo = await import("../lib/demo/scenario.ts");
  assert.equal(typeof demo.isSeededDemo, "function");

  const isSeededDemo = demo.isSeededDemo as (input: {
    demo?: boolean;
    fileNames: string[];
  }) => boolean;

  assert.equal(
    isSeededDemo({ demo: true, fileNames: ["receipt.jpg", "seller-chat.png"] }),
    true,
  );
  assert.equal(
    isSeededDemo({ demo: false, fileNames: ["receipt.jpg", "seller-chat.png"] }),
    false,
  );
  assert.equal(isSeededDemo({ demo: true, fileNames: ["holiday.jpg"] }), false);
});

test("composes a claim from confirmed facts and retrieved legal provisions", async () => {
  const claimModule = await import("../lib/claim.ts");
  assert.equal(typeof claimModule.composeClaim, "function");

  const composeClaim = claimModule.composeClaim as (input: {
    consumer: { name: string; address: string; phone: string; email: string };
    seller: string;
    product: string;
    amount: number;
    currency: string;
    purchaseDate: string;
    issue: string;
    remedy: string;
    legalBasis: Array<{ lawName: string; article: string; sourceUrl: string }>;
  }) => string;

  const claim = composeClaim({
    consumer: {
      name: "Алия Сейдахметова",
      address: "г. Алматы",
      phone: "+7 700 000 00 00",
      email: "aliya@example.kz",
    },
    seller: "ТОО «Example Electronics»",
    product: "Беспроводные наушники",
    amount: 39_990,
    currency: "KZT",
    purchaseDate: "2026-09-12",
    issue: "Не работает левый наушник",
    remedy: "вернуть уплаченную сумму",
    legalBasis: [
      {
        lawName: "Закон Республики Казахстан «О защите прав потребителей»",
        article: "15",
        sourceUrl: "https://adilet.zan.kz/rus/docs/Z100000274_",
      },
      {
        lawName: "Официальное разъяснение о возврате товара",
        article: "Порядок подачи претензии",
        sourceUrl: "https://www.gov.kz/situations/464/intro?lang=ru",
      },
    ],
  });

  assert.match(claim, /39 990 ₸/);
  assert.match(claim, /статьи 15 Закона Республики Казахстан/);
  assert.doesNotMatch(claim, /статьи Порядок подачи претензии/);
  assert.match(claim, /Не работает левый наушник/);
  assert.doesNotMatch(claim, /undefined|null/);
});

test("parses provider JSON through the requested Zod schema", async () => {
  const gemini = await import("../lib/ai/gemini.ts");
  const schemas = await import("../lib/ai/schemas.ts");
  assert.equal(typeof gemini.parseStructuredOutput, "function");

  const parseStructuredOutput = gemini.parseStructuredOutput as <T>(
    text: string,
    schema: { parse: (value: unknown) => T },
  ) => T;

  const valid = parseStructuredOutput(
    JSON.stringify({
      documentType: "receipt",
      merchant: "Example Electronics",
      purchaseDate: "2026-09-12",
      productName: "Беспроводные наушники",
      price: 39990,
      currency: "KZT",
      orderNumber: null,
      extractedText: "Кассовый чек",
      confidence: 0.94,
      unreadableReason: null,
    }),
    schemas.DocumentAnalysisSchema,
  );
  assert.equal(valid.documentType, "receipt");

  assert.throws(
    () => parseStructuredOutput("not-json", schemas.DocumentAnalysisSchema),
    /Некорректный ответ AI/,
  );
});

test("uses the user's exact description as the issue fact", async () => {
  const { buildCase } = await import("../lib/ai/build-case.ts");
  const { documentAnalysisFixture } = await import("./fixtures.ts");
  const result = await buildCase([documentAnalysisFixture], {
    problemType: "defective_product",
    problemDescription: "Левый наушник отключается через пять минут",
    locale: "ru",
  });
  assert.equal(result.issue, "Левый наушник отключается через пять минут");
  assert.deepEqual(result.facts.find((fact) => fact.key === "issue"), {
    key: "issue", label: "Проблема", value: "Левый наушник отключается через пять минут",
    source: "user", confidence: "high",
  });
});

test("uses the exact description in seeded demo analysis", async () => {
  const route = await import("../app/api/analyze/route.ts");
  const form = new FormData();
  form.set("demo", "true");
  form.set("problemType", "defective_product");
  form.set("problemDescription", "  Левый наушник отключается через пять минут  ");
  form.append("files", new File(["receipt"], "receipt.jpg", { type: "image/jpeg" }));
  form.append("files", new File(["chat"], "seller-chat.png", { type: "image/png" }));

  const response = await route.POST(new Request("http://localhost/api/analyze", {
    method: "POST", body: form,
  }));
  const payload = await response.json() as { analysis: { issue: string; facts: Array<{ key: string; value: string }> } };
  assert.equal(response.status, 200);
  assert.equal(payload.analysis.issue, "Левый наушник отключается через пять минут");
  assert.equal(payload.analysis.facts.find((fact) => fact.key === "issue")?.value, payload.analysis.issue);
});

test("returns a safe legal fallback with no invented provisions", async () => {
  const legal = await import("../lib/ai/legal-reasoning.ts");
  assert.equal(typeof legal.noReliableLegalBasis, "function");

  const result = (legal.noReliableLegalBasis as (caseType: string) => {
    status: string;
    title: string;
    legalBasis: unknown[];
    recommendedAction: string;
  })("defective_product");

  assert.equal(result.status, "no_reliable_basis_found");
  assert.match(result.title, /не нашёл достаточно надёжного/i);
  assert.deepEqual(result.legalBasis, []);
  assert.equal(result.recommendedAction, "manual_verification");
});

test("drops legal retrieval rows from non-official domains", async () => {
  const retrieval = await import("../lib/legal/retrieve.ts");
  assert.equal(typeof retrieval.filterOfficialLegalChunks, "function");

  const filterOfficialLegalChunks = retrieval.filterOfficialLegalChunks as (rows: Array<{
    id: string;
    law_name: string;
    article: string;
    section: string | null;
    text: string;
    language: string;
    source_url: string;
    score: number;
  }>) => Array<{ id: string; sourceUrl: string }>;

  const rows = filterOfficialLegalChunks([
    {
      id: "official",
      law_name: "Закон РК",
      article: "15",
      section: null,
      text: "Официальный текст",
      language: "ru",
      source_url: "https://adilet.zan.kz/rus/docs/Z100000274_",
      score: 0.91,
    },
    {
      id: "blog",
      law_name: "Пересказ",
      article: "15",
      section: null,
      text: "Неофициальный пересказ",
      language: "ru",
      source_url: "https://example.com/blog",
      score: 0.99,
    },
  ]);

  assert.deepEqual(rows.map((row) => row.id), ["official"]);
  assert.equal(rows[0].sourceUrl, "https://adilet.zan.kz/rus/docs/Z100000274_");
});

test("maps deterministic case states to the visible timeline", async () => {
  const clientCase = await import("../lib/client-case.ts");
  assert.equal(typeof clientCase.getTimelineSteps, "function");

  const getTimelineSteps = clientCase.getTimelineSteps as (state: string) => Array<{
    label: string;
    status: "complete" | "current" | "upcoming";
  }>;
  const steps = getTimelineSteps("WAITING_FOR_RESPONSE");

  assert.deepEqual(steps.map((step) => step.status), ["complete", "complete", "complete", "complete", "current", "upcoming"]);
  assert.equal(steps[4].label, "Ожидается ответ продавца");
});

test("restores serializable case data without stale browser preview URLs", async () => {
  const clientCase = await import("../lib/client-case.ts");
  assert.equal(typeof clientCase.restoreCaseSnapshot, "function");

  const restoreCaseSnapshot = clientCase.restoreCaseSnapshot as (value: string) => {
    evidence: Array<{ previewUrl?: string }>;
    state: string;
  } | null;
  const restored = restoreCaseSnapshot(JSON.stringify({
    id: "case-1",
    state: "FILES_UPLOADED",
    problemType: "defective_product",
    evidence: [{ id: "file-1", name: "receipt.jpg", size: 10, mimeType: "image/jpeg", detectedType: "Чек", status: "ready", previewUrl: "blob:stale" }],
    analysis: null,
    recommendation: null,
    claim: null,
    sellerResponse: null,
    updatedAt: "2026-09-21T10:00:00.000Z",
  }));

  assert.equal(restored?.state, "FILES_UPLOADED");
  assert.equal(restored?.evidence[0].previewUrl, undefined);
  assert.equal(restoreCaseSnapshot("not-json"), null);
});

test("migrates one legacy case into a versioned local collection", async () => {
  const history = await import("../lib/case-history.ts");
  const legacy = JSON.stringify({
    id: "case-1", state: "WAITING_FOR_RESPONSE", problemType: "defective_product",
    evidence: [{ id: "file-1", name: "receipt.jpg", size: 10, mimeType: "image/jpeg", detectedType: "Чек", status: "ready", previewUrl: "blob:stale" }],
    analysis: null, recommendation: null, claim: "claim",
    sellerResponse: null, updatedAt: "2026-09-24T10:00:00.000Z",
  });

  const result = history.restoreCaseCollection("", legacy);
  assert.equal(result.version, 2);
  assert.equal(result.activeCaseId, "case-1");
  assert.equal(result.cases.length, 1);
  assert.equal(result.cases[0].problemDescription, "");
  assert.equal(result.cases[0].claimSentAt, null);
  assert.equal(result.cases[0].sellerResponseInput, null);
  assert.equal(result.cases[0].officialActionPlan, null);
  assert.equal(result.cases[0].evidence[0].previewUrl, undefined);
});

test("upserts cases without duplicating ids and removes only the selected case", async () => {
  const history = await import("../lib/case-history.ts");
  const first = history.upsertCase({ version: 2, activeCaseId: null, cases: [] }, history.createEmptyCase("case-1"));
  const second = history.upsertCase(first, { ...history.createEmptyCase("case-2"), updatedAt: "2026-09-24T10:00:00.000Z" });
  const updated = history.upsertCase(second, { ...first.cases[0], updatedAt: "2026-09-25T10:00:00.000Z" });

  assert.equal(updated.cases.length, 2);
  assert.deepEqual(updated.cases.map((item) => item.id), ["case-1", "case-2"]);
  assert.equal(updated.activeCaseId, "case-1");
  assert.deepEqual(history.removeCase(updated, "missing"), updated);
  assert.deepEqual(history.removeCase(updated, "case-2").cases.map((item) => item.id), ["case-1"]);
  const removedActive = history.removeCase(updated, "case-1");
  assert.deepEqual(removedActive.cases.map((item) => item.id), ["case-2"]);
  assert.equal(removedActive.activeCaseId, "case-2");
});

test("malformed local case collections return empty data and keep the newest valid duplicate", async () => {
  const history = await import("../lib/case-history.ts");
  assert.deepEqual(history.restoreCaseCollection("{bad json", ""), { version: 2, activeCaseId: null, cases: [] });
  assert.deepEqual(history.restoreCaseCollection("", "{bad json"), { version: 2, activeCaseId: null, cases: [] });

  const older = { ...history.createEmptyCase("case-1"), updatedAt: "2026-09-23T10:00:00.000Z" };
  const newer = { ...older, claim: "latest claim", updatedAt: "2026-09-25T10:00:00.000Z" };
  const restored = history.restoreCaseCollection(JSON.stringify({
    version: 2,
    activeCaseId: "missing",
    cases: [older, { ...older, id: "invalid", state: "UNKNOWN" }, newer, { ...older, id: "case-2", updatedAt: "2026-09-24T10:00:00.000Z" }],
  }), "");
  assert.deepEqual(restored.cases.map((item) => item.id), ["case-1", "case-2"]);
  assert.equal(restored.cases[0].claim, "latest claim");
  assert.equal(restored.activeCaseId, "case-1");
});

test("rejects saved cases with incomplete nested data before returning them to the UI", async () => {
  const history = await import("../lib/case-history.ts");
  const base = { ...history.createEmptyCase("case-1"), updatedAt: "2026-09-24T10:00:00.000Z" };
  const brokenCases = [
    { ...base, analysis: {} },
    { ...base, recommendation: { legalBasis: [] } },
    { ...base, sellerResponseInput: { mode: "file" } },
    { ...base, sellerResponse: { responseType: "rejected" } },
    { ...base, officialActionPlan: { status: "ready" } },
    { ...base, evidence: [{}] },
  ];

  for (const broken of brokenCases) {
    const restored = history.restoreCaseCollection(JSON.stringify({ version: 2, activeCaseId: "case-1", cases: [broken] }), "");
    assert.deepEqual(restored, { version: 2, activeCaseId: null, cases: [] });
  }

  const usable = {
    ...base,
    analysis: {
      caseType: "defective_product", summary: "", seller: { name: null },
      product: { name: null, price: null, currency: "KZT" }, purchaseDate: null,
      issue: null, sellerResponse: null,
      facts: [{ key: "issue", label: "Problem", value: "Broken", source: "user", confidence: "high" }],
      missingInformation: [], confidence: "high",
    },
  };
  const restoredUsable = history.restoreCaseCollection(JSON.stringify({ version: 2, activeCaseId: "case-1", cases: [usable] }), "");
  assert.equal(restoredUsable.cases[0].analysis?.facts[0].value, "Broken");
});

test("keeps an older usable case when a newer duplicate has malformed nested data", async () => {
  const history = await import("../lib/case-history.ts");
  const older = { ...history.createEmptyCase("case-1"), claim: "saved claim", updatedAt: "2026-09-23T10:00:00.000Z" };
  const newer = { ...older, analysis: { facts: "invalid" }, claim: "corrupted claim", updatedAt: "2026-09-25T10:00:00.000Z" };

  const restored = history.restoreCaseCollection(JSON.stringify({
    version: 2, activeCaseId: "case-1", cases: [older, newer],
  }), "");

  assert.equal(restored.cases.length, 1);
  assert.equal(restored.cases[0].claim, "saved claim");
  assert.equal(restored.cases[0].updatedAt, "2026-09-23T10:00:00.000Z");
});

test("paginates claim text without dropping paragraphs", async () => {
  const pdf = await import("../lib/pdf.ts");
  assert.equal(typeof pdf.paginateClaimText, "function");

  const paginateClaimText = pdf.paginateClaimText as (text: string, maxLines: number) => string[][];
  const pages = paginateClaimText("Заголовок\n\nПервый абзац\nВторой абзац\nТретий абзац", 3);

  assert.deepEqual(pages, [
    ["Заголовок", "", "Первый абзац"],
    ["Второй абзац", "Третий абзац"],
  ]);
});

test("requires an actionable checklist for generic document explanations", async () => {
  const schemas = await import("../lib/ai/schemas.ts");
  assert.ok(schemas.DocumentExplanationSchema);
  const result = schemas.DocumentExplanationSchema.safeParse({
    title: "Ответ государственного органа",
    description: "Орган запросил дополнительные документы.",
    important: [{ label: "Срок", value: "10 дней" }],
    checklist: [],
    canAddToCase: true,
  });
  assert.equal(result.success, false);
});

test("routes payloads near Vercel's limit through direct storage upload", async () => {
  const strategy = await import("../lib/upload-strategy.ts");
  assert.equal(typeof strategy.requiresDirectUpload, "function");
  const requiresDirectUpload = strategy.requiresDirectUpload as (sizes: number[]) => boolean;

  assert.equal(requiresDirectUpload([500_000, 600_000]), false);
  assert.equal(requiresDirectUpload([3_000_000, 1_100_000]), true);
});
