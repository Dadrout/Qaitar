import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
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
  assert.match(copy, /descriptionLabel: "Опишите проблему"/);
  assert.match(app, /problemDescription=\{caseData\.problemDescription\}/);
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
  assert.match(claim, /aspect-\[1\/1\.414\]/);
  assert.match(claim, /aria-label="Действия с претензией"/);
  assert.match(response, /Ответ продавца получен/);
  assert.match(`${response}\n${responsePresentation}`, /следующий официальный шаг/i);
  assert.match(bureau, /Что это\?/);
  assert.match(bureau, /Что важно\?/);
  assert.match(bureau, /Что делать\?/);
});
