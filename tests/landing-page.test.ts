import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { register } from "tsx/esm/api";

const importComponent = register({ namespace: "qaitar-landing-contract" }).import;
const root = fileURLToPath(new URL("../", import.meta.url));

test("the supplied landing page guides visitors into the existing Qaitar application", () => {
  const html = readFileSync(new URL("public/landing/index.html", `file://${root}`), "utf8");

  assert.match(html, /Не изучай закон/);
  assert.match(html, /Как Qaitar защищает ваши права за 5 минут/);
  assert.match(html, /Полный юридический цикл в одном интерфейсе/);
  assert.ok((html.match(/href="\/app"/g) ?? []).length >= 2);
  assert.match(html, /src="\/landing\/icons\/receipt-photo\.png"/);
  assert.match(html, /id="how-it-works"/);
});

test("the root route serves the supplied static landing page", () => {
  const config = readFileSync(new URL("next.config.ts", `file://${root}`), "utf8");

  assert.match(config, /source:\s*["']\/["']/);
  assert.match(config, /destination:\s*["']\/landing\/index\.html["']/);
});

test("the browser tab icon is the compact Qaitar Q mark", () => {
  const favicon = readFileSync(new URL("public/favicon.svg", `file://${root}`), "utf8");

  assert.match(favicon, /<title>Qaitar Q<\/title>/);
  assert.match(favicon, /fill="#3366f2"/);
  assert.match(favicon, /aria-label="Qaitar"/);
});

test("the application remains available from its dedicated route", async () => {
  const { default: ApplicationPage } = await importComponent(
    "../app/app/page.tsx",
    import.meta.url,
  ) as typeof import("../app/app/page.tsx");

  assert.equal(typeof ApplicationPage, "function");
});
