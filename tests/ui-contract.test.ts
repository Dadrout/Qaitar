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

test("labels AI work and fact confirmation as explicit workflow stages", () => {
  const progress = readSource("components/qaitar/analysis-progress.tsx");
  const review = readSource("components/qaitar/case-review.tsx");
  const copy = readSource("lib/i18n/ru.ts");
  assert.match(progress, /Qaitar разбирает ситуацию/);
  assert.match(progress, /aria-live="polite"/);
  assert.match(`${review}\n${copy}`, /Проверьте факты перед юридическим анализом/);
  assert.match(`${review}\n${copy}`, /Подтвердить и проверить закон/);
});
