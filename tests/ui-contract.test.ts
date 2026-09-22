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
