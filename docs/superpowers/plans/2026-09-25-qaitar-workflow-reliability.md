# Qaitar Workflow Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the complete Qaitar consumer-dispute workflow reliable from free-form problem description through seller response and a detailed, source-backed official action plan, while adding local multi-case history.

**Architecture:** Keep `QaitarApp` as the workflow coordinator, but move persistence, seller-response normalization, deadline checks, and official-plan composition into focused pure modules. AI remains responsible only for extracting document/response facts; state transitions and official actions are deterministic and validated against retrieved official sources.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod, Google GenAI, Supabase Storage/RAG, Tailwind/shadcn, Node test runner, pdf-lib.

**Spec:** `docs/superpowers/specs/2026-09-25-qaitar-workflow-reliability-design.md`

## Global Constraints

- Preserve the current cobalt legal-fintech visual system and the Russian/Kazakh/English locale structure.
- Keep authentication, cross-device sync, government submission, and server-owned case history out of this cycle.
- Accept only PDF, JPG/JPEG, PNG, and WEBP files, no more than 10 MiB each.
- Never log raw documents, pasted seller text, generated letters, or personal data.
- Legal deadlines, authorities, channels, and provisions must come from retrieved official Kazakhstan sources; otherwise show manual verification.
- Do not add a new runtime dependency unless the existing Zod, pdf-lib, browser, and platform APIs cannot meet the requirement.

## Review Focus

- A valid `.PDF`/`.JPG` selected with an empty browser MIME type must be normalized and analyzed, not rejected or sent to Gemini with an empty MIME type; Task 4 pins this.
- A timeout after selecting a response file or entering text must preserve the input and allow one retry without duplicate requests; Task 6 pins this.
- The ten-calendar-day no-response boundary must behave correctly across time zones and exactly at midnight in Kazakhstan; Task 4 pins this.
- Corrupt, duplicated, or legacy `v1` local case data must not crash startup or silently delete another case; Task 2 pins this.
- AI output containing an authority, deadline, or URL absent from retrieved official chunks must never reach the official action UI; Task 5 pins this.

---

### Task 1: Lock the workflow contracts and state transitions

**Files:**
- Modify: `types/qaitar.ts`
- Modify: `lib/ai/schemas.ts`
- Modify: `lib/workflow.ts`
- Create: `tests/fixtures.ts`
- Test: `tests/qaitar.test.ts`

**Interfaces:**
- Produces: `SellerResponseInput`, `OfficialActionPlan`, expanded `QaitarCase`, `validateProblemInput(problemType, problemDescription)`, and deterministic transition rules used by all later tasks.
- Consumes: existing `CaseAnalysis`, `LegalBasis`, `CaseState`, and upload limits.

- [ ] **Step 1: Write failing contract tests**

Add tests with literal expectations:

```ts
test("requires a written description only for the other problem category", async () => {
  const { validateProblemInput } = await import("../lib/workflow.ts");
  assert.deepEqual(validateProblemInput("defective_product", ""), { ok: true });
  assert.deepEqual(validateProblemInput("other", ""), { ok: false, error: "Опишите проблему своими словами" });
  assert.deepEqual(validateProblemInput("other", "  Продавец списал оплату дважды  "), { ok: true });
});

test("permits only the seller-response workflow transitions", async () => {
  const { canTransition } = await import("../lib/workflow.ts");
  assert.equal(canTransition("WAITING_FOR_RESPONSE", "SELLER_RESPONSE_UPLOADED"), true);
  assert.equal(canTransition("SELLER_RESPONSE_UPLOADED", "SELLER_REJECTED"), true);
  assert.equal(canTransition("WAITING_FOR_RESPONSE", "ESCALATION_READY"), false);
  assert.equal(canTransition("SELLER_REJECTED", "ESCALATION_READY"), true);
});

test("rejects an actionable official plan without verified sources", async () => {
  const { OfficialActionPlanSchema } = await import("../lib/ai/schemas.ts");
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
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --experimental-strip-types --test --test-name-pattern='requires a written description|seller-response workflow|official action plan' tests/qaitar.test.ts`

Expected: FAIL because the new validator/types/schema do not exist.

- [ ] **Step 3: Add the domain types**

Add these public shapes to `types/qaitar.ts`:

```ts
export type SellerResponseInput =
  | { mode: "file"; fileName: string; mimeType: string; size: number; submittedAt: string }
  | { mode: "text"; text: string; submittedAt: string }
  | { mode: "no_response"; claimSentAt: string; submittedAt: string };

export type OfficialActionPlan = {
  status: "ready" | "manual_verification_required";
  title: string;
  authority: { name: string | null; reason: string; sourceUrl: string | null };
  channels: Array<{ type: "eotinish" | "etutynushy" | "written"; label: string; url: string | null; sourceUrl: string }>;
  deadline: { label: string; date: string | null; explanation: string; sourceUrl: string | null };
  steps: string[];
  requiredAttachments: string[];
  legalBasis: LegalBasis[];
  appealText: string | null;
  missingInformation: string[];
  confidence: "high" | "medium" | "low";
};
```

Extend `SellerResponseAnalysis.responseType` with `"no_response"`. Extend `QaitarCase` with `problemDescription: string`, `claimSentAt: string | null`, `sellerResponseInput: SellerResponseInput | null`, and `officialActionPlan: OfficialActionPlan | null`.

Create `tests/fixtures.ts` with complete literal fixtures used by later tasks:

```ts
import type { CaseAnalysis, SellerResponseAnalysis } from "../types/qaitar.ts";
import type { DocumentAnalysis } from "../lib/ai/schemas.ts";

export const documentAnalysisFixture: DocumentAnalysis = {
  documentType: "receipt", merchant: "Example Electronics", purchaseDate: "2026-09-12",
  productName: "Беспроводные наушники", price: 39_990, currency: "KZT",
  orderNumber: "A-42", extractedText: "Кассовый чек A-42", confidence: 0.96,
  unreadableReason: null,
};

export const caseAnalysisFixture: CaseAnalysis = {
  caseType: "defective_product", summary: "Спор по беспроводным наушникам.",
  seller: { name: "Example Electronics" },
  product: { name: "Беспроводные наушники", price: 39_990, currency: "KZT" },
  purchaseDate: "2026-09-12", issue: "Левый наушник не работает", sellerResponse: null,
  facts: [], missingInformation: [], confidence: "high",
};

export const rejectedResponseFixture: SellerResponseAnalysis = {
  responseType: "rejected", sellerReason: "Возврат не предусмотрен",
  summary: "Продавец отказал в возврате денег.", newFacts: [], requiresLegalReview: true,
};
```

- [ ] **Step 4: Add matching Zod and JSON schemas**

Create and export `OfficialActionPlanSchema` and `officialActionPlanJsonSchema` in `lib/ai/schemas.ts`. Require at least one step when status is `ready`; enforce official government domains on every `sourceUrl` using the existing `sourceUrl` validator; allow null authority/deadline sources only for `manual_verification_required`.

- [ ] **Step 5: Implement problem validation and exact transitions**

Add:

```ts
export function validateProblemInput(problemType: CaseAnalysis["caseType"] | null, description: string) {
  if (!problemType) return { ok: false as const, error: "Выберите тип проблемы" };
  if (problemType === "other" && !description.trim()) {
    return { ok: false as const, error: "Опишите проблему своими словами" };
  }
  return { ok: true as const };
}
```

Keep `WAITING_FOR_RESPONSE → SELLER_RESPONSE_UPLOADED`, classification from `SELLER_RESPONSE_UPLOADED`, and `SELLER_REJECTED → ESCALATION_READY`; remove any direct shortcut to escalation.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- --test-name-pattern='requires a written description|seller-response workflow|official action plan'`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the contract slice**

```bash
git add types/qaitar.ts lib/ai/schemas.ts lib/workflow.ts tests/fixtures.ts tests/qaitar.test.ts
git commit -m "feat: define reliable case workflow contracts"
```

### Task 2: Add versioned local multi-case persistence

**Files:**
- Create: `lib/case-history.ts`
- Modify: `lib/client-case.ts`
- Test: `tests/qaitar.test.ts`

**Interfaces:**
- Consumes: expanded `QaitarCase` from Task 1.
- Produces: `CASE_COLLECTION_KEY`, `restoreCaseCollection(v2, legacy)`, `upsertCase(collection, caseData)`, `removeCase(collection, caseId)`, and `createEmptyCase()` for the app shell.

- [ ] **Step 1: Write failing migration and collection tests**

```ts
test("migrates one legacy case into a versioned local collection", async () => {
  const history = await import("../lib/case-history.ts");
  const legacy = JSON.stringify({
    id: "case-1", state: "WAITING_FOR_RESPONSE", problemType: "defective_product",
    evidence: [], analysis: null, recommendation: null, claim: "claim",
    sellerResponse: null, updatedAt: "2026-09-24T10:00:00.000Z",
  });
  const result = history.restoreCaseCollection("", legacy);
  assert.equal(result.version, 2);
  assert.equal(result.activeCaseId, "case-1");
  assert.equal(result.cases[0].problemDescription, "");
  assert.equal(result.cases[0].officialActionPlan, null);
});

test("upserts cases without duplicating ids and removes only the selected case", async () => {
  const history = await import("../lib/case-history.ts");
  const first = history.upsertCase({ version: 2, activeCaseId: null, cases: [] }, history.createEmptyCase("case-1"));
  const updated = history.upsertCase(first, { ...first.cases[0], updatedAt: "2026-09-25T10:00:00.000Z" });
  assert.equal(updated.cases.length, 1);
  assert.equal(history.removeCase(updated, "missing").cases.length, 1);
  assert.equal(history.removeCase(updated, "case-1").cases.length, 0);
});
```

Also test malformed JSON and duplicate IDs: malformed input returns an empty collection; duplicates keep the most recently updated valid case.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --experimental-strip-types --test --test-name-pattern='legacy case|upserts cases|malformed local case' tests/qaitar.test.ts`

Expected: FAIL because `lib/case-history.ts` is absent.

- [ ] **Step 3: Implement pure collection helpers**

Use this stored envelope:

```ts
export type CaseCollection = {
  version: 2;
  activeCaseId: string | null;
  cases: QaitarCase[];
};

export const CASE_COLLECTION_KEY = "qaitar.cases.v2";
export const LEGACY_CASE_KEY = "qaitar.current-case.v1";
```

Normalize every restored case with defaults for all Task 1 fields, remove stale `previewUrl`, reject unknown states, deduplicate by id, and sort descending by `updatedAt`. Do not touch `window.localStorage` inside this module.

- [ ] **Step 4: Move empty-case creation out of the component**

Export `createEmptyCase(id = "draft")` from `lib/case-history.ts`, update `lib/client-case.ts` to consume the new shape, and keep timeline derivation pure.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- --test-name-pattern='legacy case|upserts cases|malformed local case|restores serializable case'`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit the persistence core**

```bash
git add lib/case-history.ts lib/client-case.ts tests/qaitar.test.ts
git commit -m "feat: add versioned local case history"
```

### Task 3: Carry the user's exact problem description through analysis

**Files:**
- Modify: `components/qaitar/new-case.tsx`
- Modify: `components/qaitar/qaitar-app.tsx`
- Modify: `app/api/analyze/route.ts`
- Modify: `lib/ai/build-case.ts`
- Modify: `lib/i18n/ru.ts`
- Modify: `lib/i18n/kk.ts`
- Modify: `lib/i18n/en.ts`
- Test: `tests/qaitar.test.ts`
- Test: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: `validateProblemInput` and expanded `QaitarCase` from Task 1.
- Produces: `buildCase(documents, { problemType, problemDescription, locale })` and analyze requests carrying `problemDescription` in JSON and multipart modes.

- [ ] **Step 1: Write a failing case-building test**

```ts
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
```

Add a UI contract test that finds a localized multiline field and the “Other requires text” validation path.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --test-name-pattern='exact description|multiline problem'`

Expected: FAIL because the current builder accepts a category string and the screen has no textarea.

- [ ] **Step 3: Change the deterministic case builder contract**

Replace positional category/locale arguments with:

```ts
type BuildCaseOptions = {
  problemType?: CaseAnalysisOutput["caseType"] | null;
  problemDescription?: string;
  locale?: Locale;
};
```

Use trimmed `problemDescription` as the issue. Use the localized category label only when it is empty. Keep `source="user"` for both because the user selected the category.

- [ ] **Step 4: Extend both analyze request modes**

Add `problemDescription: z.string().trim().max(2_000).default("")` to the stored JSON schema. Read the same field from multipart form data. Pass the new options object to `buildCase` in both branches.

- [ ] **Step 5: Add the textarea and validation UI**

Add a localized `Textarea` below the cards with a 2,000-character maximum, counter, hint, and inline validation. Extend `NewCase` props with `problemDescription` and `onProblemDescription`. Disable Analyze when `validateProblemInput` fails, but show the reason next to the action instead of relying only on disabled styling.

- [ ] **Step 6: Persist and submit the description**

Update `QaitarApp` so category and description changes update `caseData`; include the description in signed-upload JSON and multipart requests; keep it when files are added or removed. When the issue fact is edited in review, update `problemDescription` too.

- [ ] **Step 7: Run tests, lint, and typecheck**

Run: `npm test -- --test-name-pattern='exact description|first screen|problem'`

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 8: Commit the problem-description slice**

```bash
git add components/qaitar/new-case.tsx components/qaitar/qaitar-app.tsx app/api/analyze/route.ts lib/ai/build-case.ts lib/i18n/ru.ts lib/i18n/kk.ts lib/i18n/en.ts tests/qaitar.test.ts tests/ui-contract.test.ts
git commit -m "feat: accept a detailed consumer problem description"
```

### Task 4: Normalize seller-response inputs and no-response deadlines

**Files:**
- Create: `lib/seller-response-input.ts`
- Modify: `lib/ai/analyze-seller-response.ts`
- Modify: `lib/ai/gemini.ts`
- Modify: `app/api/seller-response/route.ts`
- Modify: `lib/ai/schemas.ts`
- Test: `tests/qaitar.test.ts`

**Interfaces:**
- Consumes: `SellerResponseInput`, upload validation, low-latency Gemini configuration, and `CaseAnalysisSchema`.
- Produces: `normalizeSellerResponseFile(file)`, `hasSellerResponseDeadlineElapsed(claimSentAt, now)`, `parseSellerResponseJson(input)`, `buildNoResponseAnalysis(locale)`, `getSellerResponseUserMessage(error)`, and a common `{ responseAnalysis, recommendation }` response.

- [ ] **Step 1: Write failing input and boundary tests**

```ts
test("normalizes a response file MIME type from its extension", async () => {
  const { normalizeSellerResponseFile } = await import("../lib/seller-response-input.ts");
  assert.deepEqual(normalizeSellerResponseFile({ name: "ANSWER.PDF", type: "", size: 100 }), {
    ok: true, mimeType: "application/pdf",
  });
});

test("treats exactly ten Kazakhstan calendar days as elapsed", async () => {
  const { hasSellerResponseDeadlineElapsed } = await import("../lib/seller-response-input.ts");
  assert.equal(hasSellerResponseDeadlineElapsed("2026-09-01", new Date("2026-09-10T17:59:59.000Z")), false);
  assert.equal(hasSellerResponseDeadlineElapsed("2026-09-01", new Date("2026-09-10T18:00:00.000Z")), true);
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

test("distinguishes timeout, invalid file, and malformed response errors", async () => {
  const { getSellerResponseUserMessage } = await import("../lib/ai/gemini.ts");
  assert.match(getSellerResponseUserMessage(new DOMException("timeout", "AbortError")), /не успел обработать/i);
  assert.match(getSellerResponseUserMessage(Object.assign(new Error("unsupported"), { code: "UNSUPPORTED_FILE" })), /формат файла/i);
  assert.match(getSellerResponseUserMessage(new Error("Некорректный ответ AI")), /не удалось распознать/i);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --test-name-pattern='normalizes a response|Kazakhstan calendar|no-response input|pasted response'`

Expected: FAIL because the helper and JSON request modes do not exist.

- [ ] **Step 3: Implement pure normalization and deadline helpers**

Use `resolveUploadType` and `validateUpload`; return the resolved MIME type explicitly. Parse `claimSentAt` as a Kazakhstan calendar date (`Asia/Almaty`, UTC+05:00 on the target date) and compare against the start of the tenth following calendar day. Reject invalid date strings.

- [ ] **Step 4: Generalize response analysis input**

Change `analyzeSellerResponse` to consume:

```ts
type AnalyzeSellerResponseInput =
  | { mode: "file"; mimeType: string; base64: string; caseSummary: string; locale: Locale }
  | { mode: "text"; text: string; caseSummary: string; locale: Locale };
```

For text mode, include the text only in the prompt. For file mode, include `inlineData`. Pass `thinkingBudget: 0` for Gemini 2.5 and `ThinkingLevel.MINIMAL` for Gemini 3, use no same-model retries, a 20-second timeout, and `maxOutputTokens: 2_048`.

- [ ] **Step 5: Add discriminated endpoint parsing**

Keep multipart for file mode and accept JSON for:

```ts
z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("text"), text: z.string().trim().min(3).max(12_000), analysis: CaseAnalysisSchema, locale: localeSchema }),
  z.object({ mode: z.literal("no_response"), claimSentAt: z.string().date(), analysis: CaseAnalysisSchema, locale: localeSchema }),
]);
```

Create the no-response analysis deterministically only when the deadline helper returns true. Return 400 before the deadline and preserve the current safe legal fallback when context is absent.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- --test-name-pattern='normalizes a response|Kazakhstan calendar|no-response input|pasted response|legacy saved case'`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the input-processing slice**

```bash
git add lib/seller-response-input.ts lib/ai/analyze-seller-response.ts lib/ai/gemini.ts app/api/seller-response/route.ts lib/ai/schemas.ts tests/qaitar.test.ts
git commit -m "fix: support reliable seller response inputs"
```

### Task 5: Build a deterministic, source-backed official action plan

**Files:**
- Create: `lib/official-action-plan.ts`
- Modify: `app/api/seller-response/route.ts`
- Modify: `data/legal/consumer-rights.ru.json`
- Modify: `types/qaitar.ts`
- Modify: `lib/ai/schemas.ts`
- Test: `tests/qaitar.test.ts`

**Interfaces:**
- Consumes: case facts, `SellerResponseAnalysis`, retrieved `LegalChunk[]`, `LegalRecommendation`, and locale.
- Produces: `buildOfficialActionPlan({ caseData, responseAnalysis, recommendation, chunks, locale, today })` returning a validated `OfficialActionPlan` without another AI call.

- [ ] **Step 1: Write failing source-safety and content tests**

```ts
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
    ],
    missingInformation: [], confidence: "high",
  } as import("../types/qaitar.ts").LegalRecommendation;
  const plan = buildOfficialActionPlan({
    caseData: caseAnalysisFixture,
    responseAnalysis: rejectedResponseFixture,
    recommendation,
    chunks,
    locale: "ru",
    today: new Date("2026-09-25T00:00:00.000Z"),
  });
  assert.equal(plan.status, "ready");
  assert.match(plan.authority.name ?? "", /Департамент торговли и защиты прав потребителей/);
  assert.equal(plan.channels[0].type, "eotinish");
  assert.ok(plan.requiredAttachments.includes("Копия претензии продавцу"));
  assert.ok(plan.steps.length >= 4);
  assert.match(plan.appealText ?? "", /прошу рассмотреть нарушение моих прав/i);
});

test("falls back when an official procedure has no retrieved source", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const { caseAnalysisFixture, rejectedResponseFixture } = await import("./fixtures.ts");
  const plan = buildOfficialActionPlan({
    caseData: caseAnalysisFixture,
    responseAnalysis: rejectedResponseFixture,
    recommendation: {
      status: "legal_basis_found", caseType: "defective_product", title: "Обращение",
      summary: "Следующий шаг", reasoning: "Продавец отказал.",
      recommendedAction: "prepare_official_appeal", legalBasis: [],
      missingInformation: [], confidence: "low",
    },
    chunks: [], locale: "ru", today: new Date("2026-09-25T00:00:00.000Z"),
  });
  assert.equal(plan.status, "manual_verification_required");
  assert.equal(plan.channels.length, 0);
  assert.equal(plan.appealText, null);
});

test("drops a procedure URL that was not retrieved", async () => {
  const { buildOfficialActionPlan } = await import("../lib/official-action-plan.ts");
  const { caseAnalysisFixture, rejectedResponseFixture } = await import("./fixtures.ts");
  const plan = buildOfficialActionPlan({
    caseData: caseAnalysisFixture,
    responseAnalysis: rejectedResponseFixture,
    recommendation: {
      status: "legal_basis_found", caseType: "defective_product", title: "Обращение",
      summary: "Следующий шаг", reasoning: "Продавец отказал.",
      recommendedAction: "prepare_official_appeal",
      legalBasis: [{ lawName: "Unknown", article: "1", explanation: "Unsafe", sourceUrl: "https://example.com" }],
      missingInformation: [], confidence: "high",
    },
    chunks: [], locale: "ru", today: new Date("2026-09-25T00:00:00.000Z"),
  });
  assert.equal(plan.status, "manual_verification_required");
  assert.equal(plan.legalBasis.length, 0);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --test-name-pattern='complete official plan|procedure has no retrieved|example.com'`

Expected: FAIL because the builder is absent.

- [ ] **Step 3: Expand the curated legal corpus with verified procedure chunks**

Add focused entries for current Articles 42-4 and 42-5 and the official gov.kz consumer-return/eOtinish guidance. Store exact official URLs and effective dates. The Article 42-5 chunk must contain the two-month filing rule and attachment requirements; the gov.kz chunk must contain the verified eOtinish route. Re-run ingestion only in environments with configured Supabase credentials.

- [ ] **Step 4: Implement deterministic plan composition**

The builder must first intersect `recommendation.legalBasis[].sourceUrl` with `chunks[].sourceUrl`. A ready plan requires: a refusal or elapsed no-response analysis, Article 42-4/42-5 support, and at least one verified submission channel. Compose localized authority text, checklist, attachments, and appeal body from case facts. Use `OfficialActionPlanSchema.parse` on the final object.

The appeal body must identify the purchase, seller, problem, prior written claim, response/no-response status, requested review, and attachment list. It must not invent a regional address, officer name, damages amount, or court claim.

- [ ] **Step 5: Return the plan from seller-response analysis**

After retrieval and legal reasoning, call `buildOfficialActionPlan`. Return `{ responseAnalysis, recommendation, officialActionPlan }`. A seller acceptance, additional-document request, or unclear response returns `officialActionPlan: null`.

- [ ] **Step 6: Run tests and legal safety checks**

Run: `npm test -- --test-name-pattern='official plan|official source|legal fallback|non-official domains'`

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the official-plan core**

```bash
git add lib/official-action-plan.ts app/api/seller-response/route.ts data/legal/consumer-rights.ru.json types/qaitar.ts lib/ai/schemas.ts tests/qaitar.test.ts
git commit -m "feat: generate a source-backed official action plan"
```

### Task 6: Rebuild the seller-response and claim-sent interaction

**Files:**
- Modify: `components/qaitar/claim-editor.tsx`
- Modify: `components/qaitar/seller-response.tsx`
- Modify: `components/qaitar/qaitar-app.tsx`
- Modify: `lib/seller-response-input.ts`
- Modify: `lib/i18n/ru.ts`
- Modify: `lib/i18n/kk.ts`
- Modify: `lib/i18n/en.ts`
- Test: `tests/ui-contract.test.ts`
- Test: `tests/qaitar.test.ts`

**Interfaces:**
- Consumes: Task 4 request modes and Task 5 endpoint response.
- Produces: `validateSellerResponseDraft(draft)`, `createSellerResponseRequest(draft, caseData, locale)`, explicit claim-sent date capture, file/text/no-response seller UI, retry-safe client submission, and correct state advancement.

- [ ] **Step 1: Write failing UI and request-control tests**

Add pure interaction tests; the browser walkthrough in Task 9 covers the rendered controls:

```ts
test("validates every seller response draft without losing its value", async () => {
  const input = await import("../lib/seller-response-input.ts");
  assert.deepEqual(input.validateSellerResponseDraft({ mode: "file", file: null }), { ok: false, error: "Выберите файл ответа" });
  assert.deepEqual(input.validateSellerResponseDraft({ mode: "text", text: "  " }), { ok: false, error: "Вставьте текст ответа продавца" });
  assert.deepEqual(input.validateSellerResponseDraft({ mode: "no_response", claimSentAt: "" }), { ok: false, error: "Укажите дату отправки претензии" });
  const valid = input.validateSellerResponseDraft({ mode: "text", text: "Продавец отказал в возврате." });
  assert.deepEqual(valid, { ok: true });
});

test("builds JSON requests for pasted and missing responses", async () => {
  const { createSellerResponseRequest } = await import("../lib/seller-response-input.ts");
  const { caseAnalysisFixture } = await import("./fixtures.ts");
  const request = createSellerResponseRequest(
    { mode: "text", text: "Продавец отказал в возврате." },
    caseAnalysisFixture,
    "ru",
  );
  assert.equal(request.headers?.["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.body as string), {
    mode: "text", text: "Продавец отказал в возврате.", analysis: caseAnalysisFixture, locale: "ru",
  });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --test-name-pattern='seller response modes|seller response request|claim sent date|retry'`

Expected: FAIL because the controls and helper do not exist.

- [ ] **Step 3: Capture claim delivery explicitly**

Replace the single “Добавить ответ продавца” jump with an action area containing a `claimSentAt` date input and “Я отправил претензию”. Persist the selected date and set `WAITING_FOR_RESPONSE`. When the case already has a date, show it and allow correction before response analysis.

- [ ] **Step 4: Implement three response modes**

In `SellerResponse`, maintain a discriminated local draft:

```ts
type SellerResponseDraft =
  | { mode: "file"; file: File | null }
  | { mode: "text"; text: string }
  | { mode: "no_response"; claimSentAt: string };
```

Render accessible segmented buttons, preserve each mode's current value while switching, normalize selected files, show per-input validation, and clear the native file input after replacement/removal.

- [ ] **Step 5: Add one in-flight request guard and retry preservation**

Move request construction into a pure helper. In `QaitarApp`, ignore submission when `busy === "response"`. Save the previous state, show `SELLER_RESPONSE_UPLOADED` while analyzing, and on failure restore `WAITING_FOR_RESPONSE` while keeping the draft inside `SellerResponse`. Do not clear the draft until a successful payload is committed.

- [ ] **Step 6: Commit the successful response atomically**

On success update `sellerResponseInput`, `sellerResponse`, `recommendation`, and `officialActionPlan` in one `updateCase` call. Set state to `SELLER_ACCEPTED`, `SELLER_REJECTED`, or `ESCALATION_READY` only according to the payload; escalation requires a ready official plan.

- [ ] **Step 7: Add all localized copy and error messages**

Add mode labels, text hints, no-response guidance, send-date labels, validation errors, retry, replace/remove file, and deadline-not-reached messages to all three locale files. No Russian literals remain in reusable components.

- [ ] **Step 8: Run focused and full client checks**

Run: `npm test -- --test-name-pattern='seller response|claim sent|retry|timeline'`

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 9: Commit the interaction slice**

```bash
git add components/qaitar/claim-editor.tsx components/qaitar/seller-response.tsx components/qaitar/qaitar-app.tsx lib/seller-response-input.ts lib/i18n/ru.ts lib/i18n/kk.ts lib/i18n/en.ts tests/ui-contract.test.ts tests/qaitar.test.ts
git commit -m "feat: rebuild the seller response workflow"
```

### Task 7: Render the full official action workspace

**Files:**
- Create: `components/qaitar/official-action-plan.tsx`
- Modify: `components/qaitar/seller-response.tsx`
- Modify: `lib/pdf.ts`
- Modify: `lib/i18n/ru.ts`
- Modify: `lib/i18n/kk.ts`
- Modify: `lib/i18n/en.ts`
- Test: `tests/ui-contract.test.ts`
- Test: `tests/qaitar.test.ts`

**Interfaces:**
- Consumes: validated `OfficialActionPlan` from Task 5.
- Produces: source-backed authority/channel/deadline/checklist UI, editable appeal text, clipboard action, PDF download, and external eOtinish navigation.

- [ ] **Step 1: Write failing presentation tests**

Render the real component to static markup rather than grepping source text:

```ts
test("renders every actionable section of an official plan", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LanguageProvider } = await import("../components/qaitar/language-provider.tsx");
  const { OfficialActionPlan } = await import("../components/qaitar/official-action-plan.tsx");
  const sourceUrl = "https://www.gov.kz/situations/464/intro?lang=ru";
  const plan = {
    status: "ready", title: "Подайте официальное обращение",
    authority: { name: "Департамент торговли и защиты прав потребителей", reason: "Рассматривает потребительские обращения", sourceUrl },
    channels: [{ type: "eotinish", label: "Подать через eOtinish", url: "https://eotinish.kz", sourceUrl }],
    deadline: { label: "Не позднее двух месяцев", date: null, explanation: "Срок обращения после претензии", sourceUrl },
    steps: ["Подготовьте документы", "Проверьте текст", "Подайте обращение", "Сохраните номер"],
    requiredAttachments: ["Копия претензии продавцу", "Ответ продавца"],
    legalBasis: [{ lawName: "Закон РК", article: "42-5", explanation: "Порядок обращения", sourceUrl }],
    appealText: "Прошу рассмотреть нарушение моих прав потребителя.",
    missingInformation: [], confidence: "high",
  } as import("../types/qaitar.ts").OfficialActionPlan;
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
    React.createElement(OfficialActionPlan, { plan })));
  assert.match(html, /Куда обратиться/);
  assert.match(html, /Что приложить/);
  assert.match(html, /Пошагово/);
  assert.match(html, /Проект обращения/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noreferrer"/);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --test-name-pattern='official action workspace|official appeal PDF'`

Expected: FAIL because the workspace component does not exist.

- [ ] **Step 3: Build the official action component**

Render separate sections for authority, deadline, channels, required attachments, ordered checklist, legal basis, and editable appeal. Show `manual_verification_required` as an amber safe fallback without submission buttons. Never render a channel whose source URL is absent.

- [ ] **Step 4: Add copy, PDF, and official-channel actions**

Keep the edited appeal in component state initialized from `plan.appealText`. Refactor the existing PDF code into `downloadTextPdf(text, { fileName, title })`; retain `downloadClaimPdf` as a wrapper and call the generic function with `qaitar-official-appeal.pdf` and title “Обращение потребителя”. Copy uses `navigator.clipboard`. The eOtinish button is a normal external link to `https://eotinish.kz`; Qaitar does not transmit data.

- [ ] **Step 5: Integrate outcome-specific rendering**

Render `OfficialActionPlan` only for `ESCALATION_READY`. An accepted response shows a localized checklist to verify the promised refund/replacement and mark the case resolved. Additional-information-requested shows the seller's requested items without adding unrelated documents. Unclear and safe-fallback outcomes request clarification/manual review; none is mislabeled as a refusal or official appeal.

- [ ] **Step 6: Run tests, accessibility-oriented lint, and typecheck**

Run: `npm test -- --test-name-pattern='official action|seller-response type|incoming documents'`

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 7: Commit the official workspace**

```bash
git add components/qaitar/official-action-plan.tsx components/qaitar/seller-response.tsx lib/pdf.ts lib/i18n/ru.ts lib/i18n/kk.ts lib/i18n/en.ts tests/ui-contract.test.ts tests/qaitar.test.ts
git commit -m "feat: add the official action workspace"
```

### Task 8: Turn “My cases” into a real local case list

**Files:**
- Create: `components/qaitar/case-list.tsx`
- Modify: `components/qaitar/qaitar-app.tsx`
- Modify: `components/qaitar/app-shell.tsx`
- Modify: `lib/i18n/ru.ts`
- Modify: `lib/i18n/kk.ts`
- Modify: `lib/i18n/en.ts`
- Test: `tests/qaitar.test.ts`
- Test: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: pure collection helpers from Task 2.
- Produces: `activateCase(collection, caseId)`, localStorage hydration/migration, active-case switching, ordered case list, confirmed deletion, and non-destructive new-case creation.

- [ ] **Step 1: Write failing list behavior tests**

Add literal collection behavior tests:

```ts
test("activates, deletes, and creates cases without losing history", async () => {
  const history = await import("../lib/case-history.ts");
  const older = { ...history.createEmptyCase("older"), updatedAt: "2026-09-20T10:00:00.000Z" };
  const newer = { ...history.createEmptyCase("newer"), updatedAt: "2026-09-25T10:00:00.000Z" };
  const collection = history.upsertCase(history.upsertCase({ version: 2, activeCaseId: null, cases: [] }, older), newer);
  assert.deepEqual(collection.cases.map((item) => item.id), ["newer", "older"]);

  const activated = history.activateCase(collection, "older");
  assert.equal(activated.activeCaseId, "older");
  assert.equal(activated.cases.length, 2);

  const afterDelete = history.removeCase(activated, "older");
  assert.equal(afterDelete.activeCaseId, "newer");
  assert.deepEqual(afterDelete.cases.map((item) => item.id), ["newer"]);

  const withDraft = history.upsertCase(afterDelete, history.createEmptyCase("draft-2"));
  assert.deepEqual(new Set(withDraft.cases.map((item) => item.id)), new Set(["newer", "draft-2"]));
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- --test-name-pattern='case list|active case|new draft preserves'`

Expected: FAIL because the app still holds one case.

- [ ] **Step 3: Replace single-case hydration with collection hydration**

On mount, read `qaitar.cases.v2` and the legacy key, call `restoreCaseCollection`, persist the migrated v2 envelope, and remove only the legacy key after successful migration. During hydration, do not overwrite storage with the initial empty draft.

- [ ] **Step 4: Persist every committed case update**

Hold `CaseCollection` plus the active `QaitarCase`; route every `updateCase` through `upsertCase`. New Case creates a fresh UUID draft and preserves existing cases. Opening a case restores its structured data; unavailable local `File` objects are not pretended to exist.

- [ ] **Step 5: Build the list and deletion UI**

Extract the current inline `CasesView` into `case-list.tsx`. Show title, user description/product, localized current stage, last update, Continue, and Delete. Confirm deletion with localized copy. If no cases remain, create an unsaved empty draft only when the user chooses New Case.

- [ ] **Step 6: Run persistence, UI, and type checks**

Run: `npm test -- --test-name-pattern='case list|legacy case|active case|new draft preserves|compact shell'`

Run: `npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 7: Commit local history integration**

```bash
git add components/qaitar/case-list.tsx components/qaitar/qaitar-app.tsx components/qaitar/app-shell.tsx lib/i18n/ru.ts lib/i18n/kk.ts lib/i18n/en.ts tests/qaitar.test.ts tests/ui-contract.test.ts
git commit -m "feat: add local multi-case history"
```

### Task 9: Verify the complete workflow and production behavior

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Test: `tests/qaitar.test.ts`
- Test: `tests/ui-contract.test.ts`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: documented setup, regression coverage, real-provider timing evidence, and a release-ready build.

- [ ] **Step 1: Add end-to-end route-level regression scenarios**

Add a route-level demo journey; earlier task tests retain coverage for pasted/no-response boundaries, timeout retry, and refresh migration:

```ts
test("completes the demo journey through an official action plan", async () => {
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
  evidence.set("problemDescription", "Левый наушник не работает");
  const analyzed = await (await analyzeRoute.POST(new Request("http://localhost/api/analyze", { method: "POST", body: evidence }))).json();
  assert.equal(analyzed.analysis.issue, "Левый наушник не работает");

  const legal = await (await legalRoute.POST(new Request("http://localhost/api/legal-recommendation", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis: analyzed.analysis, demo: true, locale: "ru" }),
  }))).json();
  assert.equal(legal.recommendation.status, "legal_basis_found");

  const claim = await (await claimRoute.POST(new Request("http://localhost/api/claim", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analysis: analyzed.analysis, recommendation: legal.recommendation, locale: "ru", consumer: {
      name: "Алия Сейдахметова", address: "Алматы", phone: "+7 700 000 00 00", email: "aliya@example.kz",
    } }),
  }))).json();
  assert.match(claim.claim, /Левый наушник не работает/);

  const response = new FormData();
  response.set("file", new File(["demo refusal"], "seller-response.pdf", { type: "application/pdf" }));
  response.set("analysis", JSON.stringify(analyzed.analysis));
  response.set("demo", "true");
  response.set("locale", "ru");
  const result = await (await sellerRoute.POST(new Request("http://localhost/api/seller-response", { method: "POST", body: response }))).json();
  assert.equal(result.responseAnalysis.responseType, "rejected");
  assert.equal(result.officialActionPlan.status, "ready");
  assert.ok(result.officialActionPlan.steps.length >= 4);
});
```

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test`

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm run build`

Expected: all commands exit 0.

- [ ] **Step 3: Perform desktop and mobile browser walkthroughs**

At desktop and mobile widths, verify file picker/camera behavior, all response modes, disabled-action explanations, keyboard focus, loading states, retry, copy, PDF generation, external source links, timeline status, case switching, refresh restoration, and deletion confirmation. Capture any browser console or network error and fix it before continuing.

- [ ] **Step 4: Run low-risk real provider smoke tests**

Use only project-owned demo assets. Measure one document analysis and one seller-response file analysis. Both must use the low-latency configuration, complete within the configured timeout or fall back with a specific retryable error, and never print document contents.

- [ ] **Step 5: Update setup and operational documentation**

Document `GEMINI_ANALYSIS_MODEL`, its fallback, the v2 local-history migration, the three seller-response modes, the curated Article 42-5/eOtinish corpus additions, the `npm run legal:ingest` requirement after corpus changes, and the fact that eOtinish submission remains manual.

- [ ] **Step 6: Inspect the final diff for unrelated changes and secrets**

Run: `git diff --check`

Run: `git status --short`

Run: `git diff -- . ':(exclude)package-lock.json'`

Expected: no secrets, raw user data, debug payloads, or unrelated formatting changes.

- [ ] **Step 7: Commit documentation and final regressions**

```bash
git add README.md .env.example tests/qaitar.test.ts tests/ui-contract.test.ts
git commit -m "test: verify the complete Qaitar case workflow"
```
