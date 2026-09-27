import assert from "node:assert/strict";
import test from "node:test";
import type { CaseAnalysis } from "../types/qaitar.ts";

test("builds a complete official plan only from allowed source chunks", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const { caseAnalysisFixture, rejectedResponseFixture } = await import("./fixtures.ts");
  const lawUrl = "https://adilet.zan.kz/rus/docs/Z100000274_";
  const guideUrl = "https://www.gov.kz/situations/464/intro?lang=ru";
  const chunks = [
    { id: "42-4", lawName: "Закон РК «О защите прав потребителей»", article: "42-4", section: "Ответ продавца", text: "При отказе или отсутствии ответа в течение десяти календарных дней потребитель вправе обратиться в уполномоченный орган.", language: "ru", sourceUrl: lawUrl },
    { id: "42-5", lawName: "Закон РК «О защите прав потребителей»", article: "42-5", section: "Обращение в государственные органы", text: "Обращение подается не позднее двух месяцев с претензией, ответом продавца и документами по покупке.", language: "ru", sourceUrl: lawUrl },
    { id: "eotinish", lawName: "Официальное разъяснение", article: "Порядок обращения", section: "Канал подачи", text: "Обращение в Департамент торговли и защиты прав потребителей можно подать через eOtinish.", language: "ru", sourceUrl: guideUrl },
  ];
  const recommendation = {
    status: "legal_basis_found", caseType: "defective_product",
    title: "Подготовьте официальное обращение", summary: "Отказ можно обжаловать.",
    reasoning: "Продавец письменно отказал после претензии.", recommendedAction: "prepare_official_appeal",
    legalBasis: [
      { lawName: "Закон РК «О защите прав потребителей»", article: "42-4, 42-5", explanation: "Разрешает обратиться в уполномоченный орган.", sourceUrl: lawUrl },
      { lawName: "Официальное разъяснение", article: "Порядок обращения", explanation: "Подтверждает подачу через eOtinish.", sourceUrl: guideUrl },
    ], missingInformation: [], confidence: "high",
  } as import("../types/qaitar.ts").LegalRecommendation;
  const plan = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: rejectedResponseFixture, recommendation, chunks, locale: "ru", today: new Date("2026-09-25T00:00:00.000Z") });
  assert.equal(plan.status, "ready");
  assert.match(plan.authority.name ?? "", /Департамент торговли и защиты прав потребителей/);
  assert.equal(plan.channels[0].type, "eotinish");
  assert.ok(plan.requiredAttachments.includes("Копия претензии продавцу"));
  assert.ok(plan.steps.length >= 4);
  assert.match(plan.appealText ?? "", /прошу рассмотреть нарушение моих прав/i);
  assert.equal(plan.deadline.date, null);
  assert.match(plan.deadline.label, /двух месяцев/i);
});

test("falls back when an official procedure has no retrieved source", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const { caseAnalysisFixture, rejectedResponseFixture } = await import("./fixtures.ts");
  const plan = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: rejectedResponseFixture, recommendation: {
    status: "legal_basis_found", caseType: "defective_product", title: "Обращение", summary: "Следующий шаг", reasoning: "Продавец отказал.", recommendedAction: "prepare_official_appeal", legalBasis: [], missingInformation: [], confidence: "low",
  }, chunks: [], locale: "ru", today: new Date("2026-09-25T00:00:00.000Z") });
  assert.equal(plan.status, "manual_verification_required");
  assert.equal(plan.channels.length, 0);
  assert.equal(plan.appealText, null);
});

test("drops a procedure URL that was not retrieved, including non-official domains", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const { caseAnalysisFixture, rejectedResponseFixture } = await import("./fixtures.ts");
  const plan = buildOfficialActionPlan({ caseData: caseAnalysisFixture, responseAnalysis: rejectedResponseFixture, recommendation: {
    status: "legal_basis_found", caseType: "defective_product", title: "Обращение", summary: "Следующий шаг", reasoning: "Продавец отказал.", recommendedAction: "prepare_official_appeal", legalBasis: [{ lawName: "Unknown", article: "1", explanation: "Unsafe", sourceUrl: "https://example.com" }], missingInformation: [], confidence: "high",
  }, chunks: [], locale: "ru", today: new Date("2026-09-25T00:00:00.000Z") });
  assert.equal(plan.status, "manual_verification_required");
  assert.equal(plan.legalBasis.length, 0);
});

test("seller-response route returns manual verification when a demo refusal has no retrieved procedure", async () => {
  const { POST } = await import("../app/api/seller-response/route.ts");
  const { caseAnalysisFixture } = await import("./fixtures.ts");
  const form = new FormData();
  form.set("file", new File(["demo refusal"], "seller-response.pdf", { type: "application/pdf" }));
  form.set("demo", "true");
  form.set("analysis", JSON.stringify(caseAnalysisFixture));
  const response = await POST(new Request("http://localhost/api/seller-response", { method: "POST", body: form }));
  const payload = await response.json() as { officialActionPlan?: { status: string; legalBasis: unknown[]; channels: unknown[] } };
  assert.equal(response.status, 200);
  assert.equal(payload.officialActionPlan?.status, "manual_verification_required");
  assert.deepEqual(payload.officialActionPlan?.legalBasis, []);
  assert.deepEqual(payload.officialActionPlan?.channels, []);
});

test("normalizes a response file MIME type from its extension", async () => {
  const { normalizeSellerResponseFile } = await import("../lib/seller-response-input.ts");
  assert.deepEqual(normalizeSellerResponseFile({ name: "ANSWER.PDF", type: "", size: 100 }), {
    ok: true, mimeType: "application/pdf",
  });
  assert.deepEqual(normalizeSellerResponseFile({ name: "answer.svg", type: "image/svg+xml", size: 100 }), {
    ok: false, error: "Этот формат не поддерживается",
  });
});

test("treats ten full Kazakhstan calendar days after receipt as elapsed", async () => {
  const { hasSellerResponseDeadlineElapsed } = await import("../lib/seller-response-input.ts");
  assert.equal(hasSellerResponseDeadlineElapsed("2026-09-01", new Date("2026-09-11T18:59:59.000Z")), false);
  assert.equal(hasSellerResponseDeadlineElapsed("2026-09-01", new Date("2026-09-11T19:00:00.000Z")), true);
  assert.equal(hasSellerResponseDeadlineElapsed("2026-02-29", new Date("2026-03-20T00:00:00.000Z")), false);
});

test("parses pasted response text without manufacturing a file", async () => {
  const { parseSellerResponseJson } = await import("../lib/seller-response-input.ts");
  const { caseAnalysisFixture } = await import("./fixtures.ts");
  const parsed = parseSellerResponseJson({
    mode: "text",
    text: "Продавец отказал в возврате и сослался на внутренние правила.",
    analysis: caseAnalysisFixture,
    locale: "ru",
  });
  assert.equal(parsed.mode, "text");
  assert.match(parsed.text, /внутренние правила/);
  assert.equal("file" in parsed, false);
});

test("creates a legal-review response only after an elapsed no-response deadline", async () => {
  const { buildNoResponseAnalysis, hasSellerResponseDeadlineElapsed } = await import("../lib/seller-response-input.ts");
  assert.equal(hasSellerResponseDeadlineElapsed("2026-09-01", new Date("2026-09-05T12:00:00.000Z")), false);
  assert.deepEqual(buildNoResponseAnalysis("ru"), {
    responseType: "no_response",
    sellerReason: null,
    summary: "Продавец не ответил на письменную претензию в установленный срок.",
    newFacts: [],
    requiresLegalReview: true,
  });
});

test("rejects a no-response request before the Kazakhstan deadline", async () => {
  const { parseSellerResponseJson } = await import("../lib/seller-response-input.ts");
  const { caseAnalysisFixture } = await import("./fixtures.ts");
  const parsed = parseSellerResponseJson({ mode: "no_response", claimSentAt: "2026-09-01", analysis: caseAnalysisFixture, locale: "ru" });
  assert.equal(parsed.mode, "no_response");
  assert.throws(() => parseSellerResponseJson({ mode: "no_response", claimSentAt: "2026-02-29", analysis: caseAnalysisFixture, locale: "ru" }));
});

test("distinguishes timeout, invalid file, and malformed response errors", async () => {
  const { getSellerResponseUserMessage } = await import("../lib/ai/gemini.ts");
  assert.match(getSellerResponseUserMessage(new DOMException("timeout", "AbortError")), /не успел обработать/i);
  assert.match(getSellerResponseUserMessage(Object.assign(new Error("unsupported"), { code: "UNSUPPORTED_FILE" })), /формат файла/i);
  assert.match(getSellerResponseUserMessage(new Error("Некорректный ответ AI")), /не удалось распознать/i);
});

test("returns a client error for malformed seller-response multipart data", async () => {
  const { POST } = await import("../app/api/seller-response/route.ts");
  const response = await POST(new Request("http://localhost/api/seller-response", {
    method: "POST",
    headers: { "content-type": "multipart/form-data" },
    body: "invalid multipart body",
  }));
  assert.equal(response.status, 400);
  const payload = await response.json() as { error?: string };
  assert.match(payload.error ?? "", /некорректные данные/i);
});

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
  assert.deepEqual(
    validateUpload({ name: "scan.PNG", type: "", size: 1024 }),
    { ok: true },
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

test("localizes new-case upload errors for Kazakh and English", async () => {
  const { selectUploadBatch } = await import("../lib/workflow.ts");
  const files = [{ name: "contract.docx", type: "application/octet-stream", size: 128 }];
  assert.equal(selectUploadBatch([], files, "kk").error, "contract.docx: Бұл файл пішімі қолдау көрсетілмейді");
  assert.equal(selectUploadBatch([], files, "en").error, "contract.docx: This file format is not supported");
  const full = Array.from({ length: 6 }, (_, index) => ({ name: `receipt-${index}.jpg`, type: "image/jpeg", size: 128 }));
  assert.equal(selectUploadBatch(full, [{ name: "extra.jpg", type: "image/jpeg", size: 128 }], "en").error, "You can add no more than 6 files");
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
  assert.equal(OfficialActionPlanSchema.safeParse({ ...readyPlan, channels: [] }).success, false);
  assert.equal(OfficialActionPlanSchema.safeParse({ ...readyPlan, appealText: null }).success, false);
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
    assert.equal(pattern.test("https://gov.kz:443@evil.example/appeal"), false);
    assert.equal(pattern.test("https://gov.kz@evil.example/appeal"), false);
  }
});

test("completes the seeded demo journey through an official action plan", async () => {
  const analyzeRoute = await import("../app/api/analyze/route.ts");
  const legalRoute = await import("../app/api/legal-recommendation/route.ts");
  const claimRoute = await import("../app/api/claim/route.ts");
  const sellerRoute = await import("../app/api/seller-response/route.ts");

  const evidence = new FormData();
  evidence.append("files", new File(["demo"], "receipt.jpg", { type: "image/jpeg" }));
  evidence.append("files", new File(["demo"], "seller-chat.png", { type: "image/png" }));
  evidence.set("demo", "true");
  evidence.set("locale", "ru");
  evidence.set("problemType", "defective_product");
  const analyzedResponse = await analyzeRoute.POST(new Request("http://localhost/api/analyze", { method: "POST", body: evidence }));
  assert.equal(analyzedResponse.status, 200);
  const analyzed = await analyzedResponse.json() as { analysis: CaseAnalysis };
  assert.equal(analyzed.analysis.issue, "Не работает левый наушник");

  const legalResponse = await legalRoute.POST(new Request("http://localhost/api/legal-recommendation", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis: analyzed.analysis, demo: true, locale: "ru" }),
  }));
  assert.equal(legalResponse.status, 200);
  const legal = await legalResponse.json() as { recommendation: import("../types/qaitar.ts").LegalRecommendation };
  assert.equal(legal.recommendation.status, "legal_basis_found");

  const claimResponse = await claimRoute.POST(new Request("http://localhost/api/claim", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis: analyzed.analysis, recommendation: legal.recommendation, locale: "ru", consumer: {
      name: "Алия Сейдахметова", address: "Алматы", phone: "+7 700 000 00 00", email: "aliya@example.kz",
    } }),
  }));
  assert.equal(claimResponse.status, 200);
  const claim = await claimResponse.json() as { claim: string };
  assert.match(claim.claim, /Не работает левый наушник/);

  const response = new FormData();
  response.set("file", new File(["demo refusal"], "seller-response.pdf", { type: "application/pdf" }));
  response.set("analysis", JSON.stringify(analyzed.analysis));
  response.set("demo", "true");
  response.set("locale", "ru");
  const resultResponse = await sellerRoute.POST(new Request("http://localhost/api/seller-response", { method: "POST", body: response }));
  assert.equal(resultResponse.status, 200);
  const result = await resultResponse.json() as { responseAnalysis: import("../types/qaitar.ts").SellerResponseAnalysis; officialActionPlan: import("../types/qaitar.ts").OfficialActionPlan };
  assert.equal(result.responseAnalysis.responseType, "rejected");
  assert.equal(result.officialActionPlan.status, "ready");
  assert.ok(result.officialActionPlan.steps.length >= 4);
  assert.equal(result.officialActionPlan.channels[0].url, "https://eotinish.kz");
  assert.equal(result.officialActionPlan.deadline.date, null);
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

test("custom seeded demo description replaces the preset narrative and selected case type", async () => {
  const route = await import("../app/api/analyze/route.ts");
  const form = new FormData();
  form.set("demo", "true");
  form.set("locale", "en");
  form.set("problemType", "other");
  form.set("problemDescription", "The seller charged me twice");
  form.append("files", new File(["receipt"], "receipt.jpg", { type: "image/jpeg" }));
  form.append("files", new File(["chat"], "seller-chat.png", { type: "image/png" }));

  const response = await route.POST(new Request("http://localhost/api/analyze", {
    method: "POST", body: form,
  }));
  const payload = await response.json() as { analysis: { caseType: string; summary: string; issue: string } };
  assert.equal(response.status, 200);
  assert.equal(payload.analysis.caseType, "other");
  assert.equal(payload.analysis.summary, "The seller charged me twice");
  assert.equal(payload.analysis.issue, "The seller charged me twice");
});

test("custom seeded demo analysis cannot receive the preset defective-product recommendation", async () => {
  const { getDemoCaseAnalysis } = await import("../lib/demo/scenario.ts");
  const route = await import("../app/api/legal-recommendation/route.ts");
  const description = "The seller charged me twice";
  const seeded = getDemoCaseAnalysis("en");
  const analysis = {
    ...seeded,
    caseType: "other",
    issue: description,
    summary: description,
    facts: seeded.facts.map((fact) => fact.key === "issue" ? { ...fact, value: description } : fact),
  };
  const response = await route.POST(new Request("http://localhost/api/legal-recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis, demo: true, locale: "en" }),
  }));
  const payload = await response.json() as { recommendation: { status: string; caseType: string; title: string; recommendedAction: string; legalBasis: unknown[] }; retrieved: number; demo: boolean };
  assert.equal(response.status, 200);
  assert.equal(payload.demo, true);
  assert.equal(payload.retrieved, 0);
  assert.equal(payload.recommendation.status, "no_reliable_basis_found");
  assert.equal(payload.recommendation.caseType, "other");
  assert.equal(payload.recommendation.title, "Qaitar did not find a sufficiently reliable legal basis in its sources.");
  assert.equal(payload.recommendation.recommendedAction, "manual_verification");
  assert.deepEqual(payload.recommendation.legalBasis, []);
});

test("unchanged seeded demo keeps its localized recommendation", async () => {
  const { getDemoCaseAnalysis } = await import("../lib/demo/scenario.ts");
  const route = await import("../app/api/legal-recommendation/route.ts");
  const response = await route.POST(new Request("http://localhost/api/legal-recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis: getDemoCaseAnalysis("en"), demo: true, locale: "en" }),
  }));
  const payload = await response.json() as { recommendation: { status: string; title: string }; retrieved: number; demo: boolean };
  assert.equal(response.status, 200);
  assert.equal(payload.demo, true);
  assert.equal(payload.retrieved, 2);
  assert.equal(payload.recommendation.status, "legal_basis_found");
  assert.equal(payload.recommendation.title, "You have grounds to request a refund");
});

test("reviewing a seeded demo issue updates every displayed issue field and avoids cached advice", async () => {
  const analyzeRoute = await import("../app/api/analyze/route.ts");
  const { applyReviewIssueEdit } = await import("../lib/case-review.ts");
  const form = new FormData();
  form.set("demo", "true");
  form.set("problemType", "defective_product");
  form.append("files", new File(["receipt"], "receipt.jpg", { type: "image/jpeg" }));
  form.append("files", new File(["chat"], "seller-chat.png", { type: "image/png" }));
  const analyzed = await analyzeRoute.POST(new Request("http://localhost/api/analyze", {
    method: "POST", body: form,
  }));
  const { analysis: initial } = await analyzed.json() as { analysis: CaseAnalysis };
  const description = "Продавец дважды списал оплату";
  const edited = applyReviewIssueEdit(initial, description, "ru", true);

  assert.equal(edited.problemDescription, description);
  assert.equal(edited.analysis.issue, description);
  assert.equal(edited.analysis.summary, description);
  assert.equal(edited.analysis.facts.find((fact) => fact.key === "issue")?.value, description);
  assert.equal(edited.analysis.facts.find((fact) => fact.key === "issue")?.source, "user");

  const legalRoute = await import("../app/api/legal-recommendation/route.ts");
  const response = await legalRoute.POST(new Request("http://localhost/api/legal-recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis: edited.analysis, demo: true, locale: "ru" }),
  }));
  const payload = await response.json() as { recommendation: { status: string; legalBasis: unknown[] } };
  assert.equal(payload.recommendation.status, "no_reliable_basis_found");
  assert.deepEqual(payload.recommendation.legalBasis, []);
});

test("reviewing a normal case issue preserves its document-based summary", async () => {
  const { applyReviewIssueEdit } = await import("../lib/case-review.ts");
  const { buildCase } = await import("../lib/ai/build-case.ts");
  const { documentAnalysisFixture } = await import("./fixtures.ts");
  const initial = await buildCase([documentAnalysisFixture], { problemType: "defective_product", locale: "en" });
  const edited = applyReviewIssueEdit(initial, "The left earbud disconnects", "en", false);
  assert.equal(edited.analysis.issue, "The left earbud disconnects");
  assert.equal(edited.analysis.summary, initial.summary);
});

test("clearing a reviewed issue uses the localized category fact and keeps legal case type", async () => {
  const { applyReviewIssueEdit } = await import("../lib/case-review.ts");
  const { getDemoCaseAnalysis } = await import("../lib/demo/scenario.ts");
  const { CaseAnalysisSchema } = await import("../lib/ai/schemas.ts");
  const edited = applyReviewIssueEdit(getDemoCaseAnalysis("kk"), "", "kk", true);

  assert.equal(edited.problemDescription, "");
  assert.equal(edited.analysis.issue, "Тауар ақаулы");
  assert.equal(edited.analysis.summary, "Тауар ақаулы");
  assert.equal(edited.analysis.facts.find((fact) => fact.key === "issue")?.value, "Тауар ақаулы");
  assert.doesNotThrow(() => CaseAnalysisSchema.parse(edited.analysis));

  const legalRoute = await import("../app/api/legal-recommendation/route.ts");
  const response = await legalRoute.POST(new Request("http://localhost/api/legal-recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis: edited.analysis, demo: true, locale: "kk" }),
  }));
  const payload = await response.json() as { recommendation: { caseType: string; status: string } };
  assert.equal(payload.recommendation.caseType, "defective_product");
  assert.equal(payload.recommendation.status, "no_reliable_basis_found");
});

test("a restored demo retains provenance for a coherent review issue edit", async () => {
  const { createEmptyCase } = await import("../lib/case-history.ts");
  const { serializeCaseSnapshot, restoreCaseSnapshot } = await import("../lib/client-case.ts");
  const { getDemoCaseAnalysis } = await import("../lib/demo/scenario.ts");
  const { applyReviewIssueEdit } = await import("../lib/case-review.ts");
  const saved = serializeCaseSnapshot({
    ...createEmptyCase("demo-case"),
    state: "DOCUMENTS_ANALYZED",
    demo: true,
    analysis: getDemoCaseAnalysis("ru"),
  });
  const restored = restoreCaseSnapshot(saved);
  assert.equal(restored?.demo, true);
  assert.ok(restored?.analysis);

  const description = "Продавец дважды списал оплату";
  const edited = applyReviewIssueEdit(restored.analysis, description, "ru", restored.demo);
  assert.equal(edited.analysis.summary, description);
  assert.equal(edited.analysis.issue, description);
  assert.equal(edited.problemDescription, description);
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

test("active case switching and new draft preserves ordered case history", async () => {
  const history = await import("../lib/case-history.ts");
  const older = { ...history.createEmptyCase("older"), updatedAt: "2026-09-20T10:00:00.000Z" };
  const newer = { ...history.createEmptyCase("newer"), updatedAt: "2026-09-25T10:00:00.000Z" };
  const collection = history.upsertCase(history.upsertCase({ version: 2, activeCaseId: null, cases: [] }, older), newer);
  assert.deepEqual(collection.cases.map((item) => item.id), ["newer", "older"]);

  const activated = history.activateCase(collection, "older");
  assert.equal(activated.activeCaseId, "older");
  assert.deepEqual(activated.cases.map((item) => item.id), ["newer", "older"]);
  assert.deepEqual(history.activateCase(activated, "missing"), activated);

  const afterDelete = history.removeCase(activated, "older");
  assert.equal(afterDelete.activeCaseId, "newer");
  assert.deepEqual(afterDelete.cases.map((item) => item.id), ["newer"]);

  const withDraft = history.upsertCase(afterDelete, history.createEmptyCase("draft-2"));
  assert.deepEqual(new Set(withDraft.cases.map((item) => item.id)), new Set(["newer", "draft-2"]));
});

test("legacy case migration writes v2 before removing the legacy case", async () => {
  const { readCaseCollection } = await import("../lib/case-collection-storage.ts");
  const { createEmptyCase } = await import("../lib/case-history.ts");
  const entries = new Map<string, string>([["qaitar.current-case.v1", JSON.stringify(createEmptyCase("legacy"))]]);
  const operations: string[] = [];
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { operations.push(`set:${key}`); entries.set(key, value); },
    removeItem: (key: string) => { operations.push(`remove:${key}`); entries.delete(key); },
  };

  const restored = readCaseCollection(storage);
  assert.equal(restored.activeCaseId, "legacy");
  assert.deepEqual(operations, ["set:qaitar.cases.v2", "remove:qaitar.current-case.v1"]);
  assert.equal(entries.has("qaitar.current-case.v1"), false);
  assert.deepEqual(JSON.parse(entries.get("qaitar.cases.v2") ?? ""), restored);
});

test("failed legacy migration retains its original data", async () => {
  const { readCaseCollection } = await import("../lib/case-collection-storage.ts");
  const entries = new Map<string, string>([["qaitar.current-case.v1", "{bad json"]]);
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };

  assert.deepEqual(readCaseCollection(storage), { version: 2, activeCaseId: null, cases: [] });
  assert.equal(entries.get("qaitar.current-case.v1"), "{bad json");
  assert.equal(entries.has("qaitar.cases.v2"), false);
});

test("legacy case remains usable when local storage cannot write the migration", async () => {
  const { readCaseCollection } = await import("../lib/case-collection-storage.ts");
  const { createEmptyCase } = await import("../lib/case-history.ts");
  const entries = new Map<string, string>([["qaitar.current-case.v1", JSON.stringify(createEmptyCase("legacy"))]]);
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: () => { throw new Error("storage full"); },
    removeItem: (key: string) => { entries.delete(key); },
  };

  assert.equal(readCaseCollection(storage).activeCaseId, "legacy");
  assert.equal(entries.has("qaitar.current-case.v1"), true);
});

test("pending case result updates its origin after switching or starting a new draft", async () => {
  const history = await import("../lib/case-history.ts");
  const first = { ...history.createEmptyCase("origin"), problemDescription: "Original draft" };
  const second = { ...history.createEmptyCase("selected"), problemDescription: "Selected draft" };
  const both = history.upsertCase(history.upsertCase({ version: 2, activeCaseId: null, cases: [] }, first), second);

  const switched = history.updateCaseById(both, "origin", { state: "DOCUMENTS_ANALYZED", claim: "origin result" });
  assert.equal(switched.activeCaseId, "selected");
  assert.equal(switched.cases.find((item) => item.id === "origin")?.claim, "origin result");
  assert.equal(switched.cases.find((item) => item.id === "selected")?.claim, null);

  const newDraft = history.createEmptyCase("new-unsaved");
  const afterNew = history.updateCaseById(switched, "origin", { claim: "latest origin result" });
  assert.equal(newDraft.claim, null);
  assert.equal(afterNew.activeCaseId, "selected");
  assert.equal(afterNew.cases.find((item) => item.id === "origin")?.claim, "latest origin result");
});

test("pending case completion cannot recreate a deleted origin or change another case", async () => {
  const history = await import("../lib/case-history.ts");
  const origin = history.createEmptyCase("origin");
  const selected = history.createEmptyCase("selected");
  const both = history.upsertCase(history.upsertCase({ version: 2, activeCaseId: null, cases: [] }, origin), selected);
  const afterDelete = history.removeCase(both, "origin");
  const lateSuccess = history.updateCaseById(afterDelete, "origin", { state: "CLAIM_GENERATED", claim: "late result" });
  const lateErrorRollback = history.updateCaseById(afterDelete, "origin", { state: "WAITING_FOR_RESPONSE" });

  assert.strictEqual(lateSuccess, afterDelete);
  assert.strictEqual(lateErrorRollback, afterDelete);
  assert.deepEqual(afterDelete.cases.map((item) => item.id), ["selected"]);
  assert.equal(afterDelete.cases[0].state, "NEW_CASE");
  assert.equal(history.getActiveCase(history.removeCase(afterDelete, "selected")), null);
});

test("failed collection writes report failure without interrupting the in-memory case", async () => {
  const { readCaseCollection, writeCaseCollection } = await import("../lib/case-collection-storage.ts");
  const { createEmptyCase } = await import("../lib/case-history.ts");
  const legacy = JSON.stringify(createEmptyCase("legacy"));
  const entries = new Map<string, string>([["qaitar.current-case.v1", legacy]]);
  let failures = 0;
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: () => { throw new Error("quota exceeded"); },
    removeItem: (key: string) => { entries.delete(key); },
  };

  const restored = readCaseCollection(storage, () => { failures += 1; });
  assert.equal(restored.activeCaseId, "legacy");
  assert.equal(writeCaseCollection(storage, restored), false);
  assert.equal(failures, 1);
  assert.equal(entries.get("qaitar.current-case.v1"), legacy);
});

test("unavailable browser storage is acquired once without crashing or writing", async () => {
  const { acquireCaseStorage, readCaseCollection, writeCaseCollection } = await import("../lib/case-collection-storage.ts");
  let acquisitions = 0;
  let warnings = 0;
  const browser = {
    get localStorage(): Storage {
      acquisitions += 1;
      throw new Error("localStorage access denied");
    },
  };
  const storage = acquireCaseStorage(() => browser.localStorage, () => { warnings += 1; });

  assert.equal(storage, null);
  assert.deepEqual(readCaseCollection(storage), { version: 2, activeCaseId: null, cases: [] });
  assert.equal(writeCaseCollection(storage, { version: 2, activeCaseId: null, cases: [] }), false);
  assert.equal(acquisitions, 1);
  assert.equal(warnings, 1);
});

test("failed current collection read still restores legacy without overwriting unknown current data", async () => {
  const { readCaseCollection } = await import("../lib/case-collection-storage.ts");
  const { createEmptyCase } = await import("../lib/case-history.ts");
  const legacy = JSON.stringify(createEmptyCase("legacy"));
  const operations: string[] = [];
  let warnings = 0;
  const storage = {
    getItem: (key: string) => {
      if (key === "qaitar.cases.v2") throw new Error("read denied");
      return legacy;
    },
    setItem: () => { operations.push("set"); },
    removeItem: () => { operations.push("remove"); },
  };

  const restored = readCaseCollection(storage, () => { warnings += 1; });
  assert.equal(restored.activeCaseId, "legacy");
  assert.deepEqual(operations, []);
  assert.equal(warnings, 1);
});

test("failed legacy read still restores current collection and reports the warning", async () => {
  const { readCaseCollection } = await import("../lib/case-collection-storage.ts");
  const { createEmptyCase } = await import("../lib/case-history.ts");
  const current = { version: 2, activeCaseId: "current", cases: [createEmptyCase("current")] };
  let warnings = 0;
  const storage = {
    getItem: (key: string) => {
      if (key === "qaitar.current-case.v1") throw new Error("read denied");
      return JSON.stringify(current);
    },
    setItem: () => { throw new Error("should not migrate"); },
    removeItem: () => { throw new Error("should not remove"); },
  };

  assert.deepEqual(readCaseCollection(storage, () => { warnings += 1; }), current);
  assert.equal(warnings, 1);
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

test("seller response draft validation covers file, text, and receipt chronology", async () => {
  const input = await import("../lib/seller-response-input.ts");
  assert.deepEqual(input.validateSellerResponseDraft({ mode: "file", file: null }), { ok: false, error: "Выберите файл ответа" });
  assert.deepEqual(input.validateSellerResponseDraft({ mode: "text", text: "  " }), { ok: false, error: "Вставьте текст ответа продавца" });
  assert.deepEqual(input.validateSellerResponseDraft({ mode: "no_response", claimSentAt: "", claimReceivedAt: "", receiptVerified: false }), { ok: false, error: "Укажите дату отправки претензии" });
  assert.deepEqual(input.validateSellerResponseDraft({ mode: "no_response", claimSentAt: "2026-09-02", claimReceivedAt: "2026-09-01", receiptVerified: true }), { ok: false, error: "Дата получения не может быть раньше даты отправки" });
  assert.deepEqual(input.validateSellerResponseDraft({ mode: "no_response", claimSentAt: "2026-09-01", claimReceivedAt: "2026-09-01", receiptVerified: true }, "ru", new Date("2026-09-11T18:59:59Z")), { ok: false, error: "Срок ответа продавца ещё не истёк" });
  assert.deepEqual(input.validateSellerResponseDraft({ mode: "no_response", claimSentAt: "2026-09-01", claimReceivedAt: "2026-09-01", receiptVerified: true }, "ru", new Date("2026-09-11T19:00:00Z")), { ok: true });
  assert.deepEqual(input.validateSellerResponseDraft({ mode: "text", text: "Продавец отказал в возврате." }), { ok: true });
});

test("seller response requests use JSON for text and verified receipt, multipart for files", async () => {
  const { createSellerResponseRequest } = await import("../lib/seller-response-input.ts");
  const { caseAnalysisFixture } = await import("./fixtures.ts");
  const textRequest = createSellerResponseRequest({ mode: "text", text: "  Продавец отказал.  " }, caseAnalysisFixture, "ru");
  assert.equal((textRequest.headers as Record<string, string>)["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(textRequest.body as string), { mode: "text", text: "Продавец отказал.", analysis: caseAnalysisFixture, locale: "ru" });

  const noResponseRequest = createSellerResponseRequest({ mode: "no_response", claimSentAt: "2026-09-01", claimReceivedAt: "2026-09-03", receiptVerified: true }, caseAnalysisFixture, "en");
  assert.deepEqual(JSON.parse(noResponseRequest.body as string), { mode: "no_response", claimSentAt: "2026-09-01", claimReceivedAt: "2026-09-03", analysis: caseAnalysisFixture, locale: "en" });
  const unverifiedRequest = createSellerResponseRequest({ mode: "no_response", claimSentAt: "2026-09-01", claimReceivedAt: "", receiptVerified: false }, caseAnalysisFixture, "ru");
  assert.equal(JSON.parse(unverifiedRequest.body as string).claimReceivedAt, undefined);

  const file = new File(["reply"], "reply.pdf", { type: "application/pdf" });
  const fileRequest = createSellerResponseRequest({ mode: "file", file }, caseAnalysisFixture, "kk", true);
  assert.ok(fileRequest.body instanceof FormData);
  assert.equal(fileRequest.body.get("file"), file);
  assert.equal(fileRequest.body.get("demo"), "true");
});

test("seller response state advances only when an official plan is ready", async () => {
  const { sellerResponseNextState } = await import("../lib/seller-response-input.ts");
  assert.equal(sellerResponseNextState({ responseType: "accepted" }, null), "SELLER_ACCEPTED");
  assert.equal(sellerResponseNextState({ responseType: "rejected" }, { status: "manual_verification_required" }), "SELLER_REJECTED");
  assert.equal(sellerResponseNextState({ responseType: "no_response" }, { status: "ready" }), "ESCALATION_READY");
  assert.equal(sellerResponseNextState({ responseType: "unclear" }, { status: "ready" }), "SELLER_REJECTED");
});

test("official appeal PDF uses the edited text, appeal title, and separate filename", async () => {
  const { downloadTextPdf } = await import("../lib/pdf.ts");
  const { PDFDocument } = await import("pdf-lib");
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";
  const drawn: string[] = [];
  const anchor = { href: "", download: "", click() {}, remove() {} };
  const context = { measureText: (value: string) => ({ width: value.length * 10 }), fillRect() {}, fillText: (value: string) => { drawn.push(value); }, fillStyle: "", font: "" };
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  let savedBlob: Blob | null = null;
  try {
    globalThis.document = { createElement: (tag: string) => tag === "canvas" ? { width: 0, height: 0, getContext: () => context, toDataURL: () => png } : anchor, body: { appendChild() {} } } as unknown as Document;
    globalThis.window = { setTimeout: () => 0 } as unknown as Window & typeof globalThis;
    URL.createObjectURL = (blob: Blob) => { savedBlob = blob; return "blob:test"; };
    URL.revokeObjectURL = () => {};
    await downloadTextPdf("Edited official appeal", { fileName: "qaitar-official-appeal.pdf", title: "Обращение потребителя" });
    assert.equal(anchor.download, "qaitar-official-appeal.pdf");
    assert.ok(drawn.includes("Edited official appeal"));
    const captured = savedBlob as unknown as Blob;
    assert.ok(captured);
    const pdf = await PDFDocument.load(await captured.arrayBuffer());
    assert.equal(pdf.getTitle(), "Обращение потребителя");
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    URL.createObjectURL = previousCreate;
    URL.revokeObjectURL = previousRevoke;
  }
});

test("official appeal PDF wraps a long submission reference without clipping", async () => {
  const { downloadTextPdf } = await import("../lib/pdf.ts");
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";
  const url = `https://eotinish.kz/appeal/${"A".repeat(260)}`;
  const lines: string[] = [];
  const context = { measureText: (value: string) => ({ width: value.length * 10 }), fillRect() {}, fillText: (value: string) => { lines.push(value); }, fillStyle: "", font: "" };
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousCreate = URL.createObjectURL;
  const previousRevoke = URL.revokeObjectURL;
  try {
    globalThis.document = { createElement: (tag: string) => tag === "canvas" ? { width: 0, height: 0, getContext: () => context, toDataURL: () => png } : { href: "", download: "", click() {}, remove() {} }, body: { appendChild() {} } } as unknown as Document;
    globalThis.window = { setTimeout: () => 0 } as unknown as Window & typeof globalThis;
    URL.createObjectURL = () => "blob:test";
    URL.revokeObjectURL = () => {};
    await downloadTextPdf(url, { fileName: "appeal.pdf", title: "Обращение потребителя" });
    const referenceLines = lines.filter((line) => line.includes("https://") || /^A+$/.test(line));
    assert.equal(referenceLines.join(""), url);
    assert.ok(referenceLines.length > 1);
    assert.ok(referenceLines.every((line) => context.measureText(line).width <= 1020));
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    URL.createObjectURL = previousCreate;
    URL.revokeObjectURL = previousRevoke;
  }
});

test("seller response drafts retain each mode value while switching", async () => {
  const { emptySellerResponseDrafts, saveSellerResponseDraft } = await import("../lib/seller-response-input.ts");
  const file = new File(["reply"], "reply.pdf", { type: "application/pdf" });
  const initial = emptySellerResponseDrafts("2026-09-01");
  const withFile = saveSellerResponseDraft(initial, { mode: "file", file });
  const withText = saveSellerResponseDraft(withFile, { mode: "text", text: "Seller refused." });
  assert.equal(withText.file.file, file);
  assert.equal(withText.text.text, "Seller refused.");
  assert.equal(withText.no_response.claimSentAt, "2026-09-01");
});

test("claim sent date cannot be an impossible or future calendar day", async () => {
  const { validateClaimSentDate } = await import("../lib/seller-response-input.ts");
  const now = new Date("2026-09-26T12:00:00Z");
  assert.equal(validateClaimSentDate("2026-02-29", now), false);
  assert.equal(validateClaimSentDate("2026-09-27", now), false);
  assert.equal(validateClaimSentDate("2026-09-26", now), true);
});

test("editing the sent date requires confirming it again before opening the response", async () => {
  const { isClaimSentConfirmed } = await import("../lib/seller-response-input.ts");
  assert.equal(isClaimSentConfirmed("WAITING_FOR_RESPONSE", "2026-09-01", "2026-09-01"), true);
  assert.equal(isClaimSentConfirmed("WAITING_FOR_RESPONSE", "2026-09-01", "2026-09-02"), false);
  assert.equal(isClaimSentConfirmed("CLAIM_GENERATED", null, "2026-09-01"), false);
});
