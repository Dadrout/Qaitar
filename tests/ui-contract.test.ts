import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

const root = fileURLToPath(new URL("../", import.meta.url));
const importComponent = register({ namespace: "qaitar-ui-contract" }).import;
export const readSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, `file://${root}`), "utf8");

test("uses the refined LegalTech visual tokens and reduced-motion guard", () => {
  const css = readSource("app/globals.css");
  assert.match(css, /--background:\s*#f6f8fc/);
  assert.match(css, /--foreground:\s*#142038/);
  assert.match(css, /--primary:\s*#195eea/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /transition-duration:\s*\.01ms/);
});

test("renders the compact shell and evidence-to-action tagline", () => {
  const shell = readSource("components/qaitar/app-shell.tsx");
  assert.match(shell, /Доказательства → Закон → Действие/);
  assert.match(shell, /lg:grid-cols-\[232px_minmax\(0,1fr\)\]/);
  assert.match(shell, /qaitar-logo\.png/);
});

test("case list shows ordered drafts with descriptions, stages, and separate actions", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LanguageProvider } = await importComponent("../components/qaitar/language-provider.tsx", import.meta.url) as typeof import("../components/qaitar/language-provider.tsx");
  const { CaseList } = await importComponent("../components/qaitar/case-list.tsx", import.meta.url) as typeof import("../components/qaitar/case-list.tsx");
  const { createEmptyCase } = await import("../lib/case-history.ts");
  const cases = [
    { ...createEmptyCase("older"), state: "WAITING_FOR_RESPONSE" as const, problemDescription: "Refund still missing", updatedAt: "2026-09-20T10:00:00.000Z" },
    { ...createEmptyCase("newer"), problemDescription: "Laptop screen flickers", updatedAt: "2026-09-25T10:00:00.000Z" },
  ];
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
    React.createElement(CaseList, { cases, onContinue() {}, onDelete() {}, onNew() {} })));
  assert.match(html, /Laptop screen flickers/);
  assert.match(html, /Refund still missing/);
  assert.ok(html.indexOf("Laptop screen flickers") < html.indexOf("Refund still missing"));
  assert.match(html, /Ожидается ответ продавца/);
  assert.equal((html.match(/Продолжить дело/g) ?? []).length, 2);
  assert.equal((html.match(/Удалить дело/g) ?? []).length, 2);
});

test("case list keeps its empty state until a new case is requested", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LanguageProvider } = await importComponent("../components/qaitar/language-provider.tsx", import.meta.url) as typeof import("../components/qaitar/language-provider.tsx");
  const { CaseList } = await importComponent("../components/qaitar/case-list.tsx", import.meta.url) as typeof import("../components/qaitar/case-list.tsx");
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
    React.createElement(CaseList, { cases: [], onContinue() {}, onDelete() {}, onNew() {} })));
  assert.match(html, /Здесь появятся сохранённые дела/);
  assert.doesNotMatch(html, /Продолжить дело|Удалить дело/);
});

test("resolved case list shows the final workflow stage", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LanguageProvider } = await importComponent("../components/qaitar/language-provider.tsx", import.meta.url) as typeof import("../components/qaitar/language-provider.tsx");
  const { CaseList } = await importComponent("../components/qaitar/case-list.tsx", import.meta.url) as typeof import("../components/qaitar/case-list.tsx");
  const { createEmptyCase } = await import("../lib/case-history.ts");
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
    React.createElement(CaseList, { cases: [{ ...createEmptyCase("done"), state: "RESOLVED" }], onContinue() {}, onDelete() {}, onNew() {} })));
  assert.match(html, /Келесі ресми қадам|Следующий официальный шаг/);
});

test("renders distinct completed, current, and upcoming timeline states", () => {
  const timeline = readSource("components/qaitar/case-timeline.tsx");
  assert.match(timeline, /aria-current/);
  assert.match(timeline, /step\.status === "complete"/);
  assert.match(timeline, /step\.status === "current"/);
});

test("makes the first screen evidence-first and explains the disabled action", () => {
  const screen = readSource("components/qaitar/new-case.tsx");
  const copy = readSource("lib/i18n/ru.ts");
  assert.match(`${screen}\n${copy}`, /Загрузите доказательства/);
  assert.match(`${screen}\n${copy}`, /Что произошло\?/);
  assert.match(screen, /files\.length === 0[\s\S]*Добавьте хотя бы один файл/);
  assert.match(screen, /Проверяем по официальным источникам Казахстана/);
  assert.match(screen, /aria-pressed=\{selected\}/);
});

test("provides a localized multiline problem field and explains required text for Other", () => {
  const screen = readSource("components/qaitar/new-case.tsx");
  const app = readSource("components/qaitar/qaitar-app.tsx");
  const copy = readSource("lib/i18n/ru.ts");
  assert.match(screen, /<Textarea[\s\S]*maxLength=\{2_000\}/);
  assert.match(screen, /validateProblemInput\(problemType, problemDescription\)/);
  assert.match(screen, /problemType === "other"[\s\S]*messages\.newCase\.descriptionRequired/);
  assert.match(screen, /messages\.newCase\.descriptionLabel/);
  assert.doesNotMatch(screen, /aria-describedby="problem-description-hint problem-description-error"/);
  assert.match(copy, /descriptionLabel: "Опишите проблему"/);
  assert.match(app, /problemDescription=\{caseData\.problemDescription\}/);
  assert.match(app, /if \(key === "issue"\)[\s\S]*applyReviewIssueEdit/);
  assert.match(app, /const demo = caseData\.demo/);
});

test("labels AI work and fact confirmation as explicit workflow stages", () => {
  const progress = readSource("components/qaitar/analysis-progress.tsx");
  const review = readSource("components/qaitar/case-review.tsx");
  const copy = readSource("lib/i18n/ru.ts");
  assert.match(progress, /Qaitar разбирает ситуацию/);
  assert.match(progress, /aria-live="polite"/);
  assert.match(`${review}\n${copy}`, /Проверьте факты перед юридическим анализом/);
  assert.match(`${review}\n${copy}`, /Подтвердить и проверить закон/);
});

test("separates facts, law, and next action without offering unsupported claims", () => {
  const result = readSource("components/qaitar/legal-result.tsx");
  assert.match(result, /Что произошло/);
  assert.match(result, /Что говорит закон/);
  assert.match(result, /Что делать дальше/);
  assert.match(result, /found &&[\s\S]*onPrepare/);
  assert.match(result, /Официальный источник/);
});

test("presents generated and incoming documents as actionable workflow artifacts", () => {
  const claim = readSource("components/qaitar/claim-editor.tsx");
  const response = readSource("components/qaitar/seller-response.tsx");
  const responsePresentation = readSource("lib/seller-response-presentation.ts");
  const bureau = readSource("components/qaitar/document-workspace.tsx");
  const copy = readSource("lib/i18n/ru.ts");
  assert.match(claim, /aspect-\[1\/1\.414\]/);
  assert.match(`${claim}\n${copy}`, /Действия с претензией/);
  assert.match(`${response}\n${copy}`, /Ответ продавца получен/);
  assert.match(`${response}\n${responsePresentation}\n${copy}`, /следующий официальный шаг/i);
  assert.match(`${bureau}\n${copy}`, /Что это\?/);
  assert.match(`${bureau}\n${copy}`, /Что важно\?/);
  assert.match(`${bureau}\n${copy}`, /Что делать\?/);
});

test("official action workspace renders every ready-plan section and verified external channel", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LanguageProvider } = await importComponent("../components/qaitar/language-provider.tsx", import.meta.url) as typeof import("../components/qaitar/language-provider.tsx");
  const { OfficialActionPlan } = await importComponent("../components/qaitar/official-action-plan.tsx", import.meta.url) as typeof import("../components/qaitar/official-action-plan.tsx");
  const sourceUrl = "https://www.gov.kz/situations/464/intro?lang=ru";
  const plan = {
    status: "ready", title: "Подайте официальное обращение",
    authority: { name: "Департамент торговли и защиты прав потребителей", reason: "Рассматривает потребительские обращения", sourceUrl },
    channels: [{ type: "eotinish", label: "Подать через eOtinish", url: "https://eotinish.kz", sourceUrl }],
    deadline: { label: "Не позднее двух месяцев", date: null, explanation: "Срок обращения после претензии", sourceUrl },
    steps: ["Подготовьте документы", "Проверьте текст", "Подайте обращение", "Сохраните номер"],
    requiredAttachments: ["Копия претензии продавцу", "Ответ продавца"],
    legalBasis: [{ lawName: "Закон РК", article: "42-5", explanation: "Порядок обращения", sourceUrl }],
    appealText: "Прошу рассмотреть нарушение моих прав потребителя.", missingInformation: [], confidence: "high",
  } as import("../types/qaitar.ts").OfficialActionPlan;
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
    React.createElement(OfficialActionPlan, { plan })));
  assert.match(html, /Куда обратиться/);
  assert.match(html, /Не позднее двух месяцев/);
  assert.match(html, /Что приложить/);
  assert.match(html, /Пошагово/);
  assert.match(html, /Проект обращения/);
  assert.match(html, /42-5/);
  assert.match(html, /href="https:\/\/eotinish\.kz"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noreferrer"/);
  assert.match(html, /Прошу рассмотреть нарушение моих прав потребителя/);
});

test("official action workspace with manual verification has no appeal or active action", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LanguageProvider } = await importComponent("../components/qaitar/language-provider.tsx", import.meta.url) as typeof import("../components/qaitar/language-provider.tsx");
  const { OfficialActionPlan } = await importComponent("../components/qaitar/official-action-plan.tsx", import.meta.url) as typeof import("../components/qaitar/official-action-plan.tsx");
  const plan = {
    status: "manual_verification_required", title: "Нужна проверка",
    authority: { name: null, reason: "Источник не найден", sourceUrl: null }, channels: [],
    deadline: { label: "Проверьте срок", date: null, explanation: "Дата получения не подтверждена", sourceUrl: null },
    steps: [], requiredAttachments: [], legalBasis: [], appealText: null,
    missingInformation: ["Подтверждение получения претензии продавцом"], confidence: "low",
  } as import("../types/qaitar.ts").OfficialActionPlan;
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null,
    React.createElement(OfficialActionPlan, { plan })));
  assert.match(html, /Требуется ручная проверка/);
  assert.match(html, /Подтверждение получения претензии продавцом/);
  assert.doesNotMatch(html, /<button|href="https:\/\/eotinish\.kz"|Проект обращения/);
});

test("seller outcomes show accepted follow-through without misattributing legal gaps to the seller", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LanguageProvider } = await importComponent("../components/qaitar/language-provider.tsx", import.meta.url) as typeof import("../components/qaitar/language-provider.tsx");
  const { SellerResponse } = await importComponent("../components/qaitar/seller-response.tsx", import.meta.url) as typeof import("../components/qaitar/seller-response.tsx");
  const base: Omit<import("../types/qaitar.ts").SellerResponseAnalysis, "responseType"> = { sellerReason: null, summary: "Позиция продавца", newFacts: [], requiresLegalReview: false };
  const props = { recommendation: null, plan: null, state: "SELLER_ACCEPTED" as const, draft: { mode: "text" as const, text: "" }, onDraftChange() {}, onModeChange() {}, onAnalyze() {}, onDemo() {}, onMarkResolved() {}, error: null };
  const render = (responseType: "accepted" | "additional_information_requested", recommendation: import("../types/qaitar.ts").LegalRecommendation | null = null) => renderToStaticMarkup(React.createElement(LanguageProvider, null,
    React.createElement(SellerResponse, { ...props, result: { ...base, responseType }, recommendation })));
  const accepted = render("accepted");
  assert.match(accepted, /Проверьте возврат или замену/);
  assert.match(accepted, /Отметить дело решённым/);
  assert.doesNotMatch(accepted, /Проект обращения/);
  const requested = render("additional_information_requested", {
    status: "additional_information_required", caseType: "defective_product", title: "Уточнение", summary: "Нужны данные", reasoning: "Продавец запросил данные", recommendedAction: "provide_document", legalBasis: [], missingInformation: ["Серийный номер товара"], confidence: "medium",
  });
  assert.match(requested, /Позиция продавца/);
  assert.doesNotMatch(requested, /Серийный номер товара/);
  assert.doesNotMatch(requested, /Копия претензии продавцу|Проект обращения/);
});

test("manual seller outcome suppresses all unsupported appeal guidance", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LanguageProvider } = await importComponent("../components/qaitar/language-provider.tsx", import.meta.url) as typeof import("../components/qaitar/language-provider.tsx");
  const { SellerResponse } = await importComponent("../components/qaitar/seller-response.tsx", import.meta.url) as typeof import("../components/qaitar/seller-response.tsx");
  const result: import("../types/qaitar.ts").SellerResponseAnalysis = { responseType: "rejected", sellerReason: "Продавец отказал", summary: "Ответ продавца", newFacts: [], requiresLegalReview: true };
  const recommendation: import("../types/qaitar.ts").LegalRecommendation = { status: "legal_basis_found", caseType: "defective_product", title: "Подготовьте официальное обращение", summary: "Подавайте обращение прямо сейчас", reasoning: "Проверенный канал подачи найден", recommendedAction: "prepare_official_appeal", legalBasis: [], missingInformation: [], confidence: "high" };
  const plan: import("../types/qaitar.ts").OfficialActionPlan = { status: "manual_verification_required", title: "Проверьте порядок", authority: { name: null, reason: "Не подтверждено", sourceUrl: null }, channels: [], deadline: { label: "Уточните срок", date: null, explanation: "Источник не найден", sourceUrl: null }, steps: [], requiredAttachments: [], legalBasis: [], appealText: null, missingInformation: ["Подтвердите дату получения"], confidence: "low" };
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(SellerResponse, { result, recommendation, plan, state: "SELLER_REJECTED", draft: { mode: "text", text: "" }, onDraftChange() {}, onModeChange() {}, onAnalyze() {}, onDemo() {}, onMarkResolved() {}, error: null })));
  assert.match(html, /Требуется ручная проверка/);
  assert.match(html, /Подтвердите дату получения/);
  assert.doesNotMatch(html, /Подготовьте официальное обращение|Подавайте обращение прямо сейчас|Проверенный канал подачи найден|нашёл следующий официальный шаг|href="https:\/\/eotinish\.kz"/);
});

test("ready seller outcome keeps the official workspace without a contradictory fallback", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LanguageProvider } = await importComponent("../components/qaitar/language-provider.tsx", import.meta.url) as typeof import("../components/qaitar/language-provider.tsx");
  const { SellerResponse } = await importComponent("../components/qaitar/seller-response.tsx", import.meta.url) as typeof import("../components/qaitar/seller-response.tsx");
  const sourceUrl = "https://www.gov.kz/situations/464/intro?lang=ru";
  const plan: import("../types/qaitar.ts").OfficialActionPlan = { status: "ready", title: "Подайте обращение", authority: { name: "Департамент", reason: "Рассматривает обращения", sourceUrl }, channels: [{ type: "eotinish", label: "Подать через eOtinish", url: "https://eotinish.kz", sourceUrl }], deadline: { label: "До двух месяцев", date: null, explanation: "Проверьте начало срока", sourceUrl }, steps: ["Подготовьте документы"], requiredAttachments: ["Копия претензии"], legalBasis: [], appealText: "Прошу рассмотреть обращение", missingInformation: [], confidence: "high" };
  const result: import("../types/qaitar.ts").SellerResponseAnalysis = { responseType: "rejected", sellerReason: "Отказ", summary: "Ответ продавца", newFacts: [], requiresLegalReview: true };
  const html = renderToStaticMarkup(React.createElement(LanguageProvider, null, React.createElement(SellerResponse, { result, recommendation: null, plan, state: "ESCALATION_READY", draft: { mode: "text", text: "" }, onDraftChange() {}, onModeChange() {}, onAnalyze() {}, onDemo() {}, onMarkResolved() {}, error: null })));
  assert.match(html, /href="https:\/\/eotinish\.kz"/);
  assert.match(html, /Проект обращения/);
  assert.doesNotMatch(html, /не нашёл надёжного правового основания|Требуется ручная проверка/);
});
