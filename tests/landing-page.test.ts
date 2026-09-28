import assert from "node:assert/strict";
import test from "node:test";
import { register } from "tsx/esm/api";

const importComponent = register({ namespace: "qaitar-landing-contract" }).import;

test("landing page guides visitors into the existing Qaitar application", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { LandingPage } = await importComponent(
    "../components/qaitar/landing-page.tsx",
    import.meta.url,
  ) as typeof import("../components/qaitar/landing-page.tsx");

  const html = renderToStaticMarkup(React.createElement(LandingPage));

  assert.match(html, /Не изучай закон/);
  assert.match(html, /Как Qaitar защищает ваши права за 5 минут/);
  assert.match(html, /Полный юридический цикл в одном интерфейсе/);
  assert.ok((html.match(/href="\/app"/g) ?? []).length >= 3);
  assert.match(html, /href="#how-it-works"/);
  assert.match(html, /id="how-it-works"/);
});

test("the application remains available from its dedicated route", async () => {
  const { default: ApplicationPage } = await importComponent(
    "../app/app/page.tsx",
    import.meta.url,
  ) as typeof import("../app/app/page.tsx");

  assert.equal(typeof ApplicationPage, "function");
});
