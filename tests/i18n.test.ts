import assert from "node:assert/strict";
import test from "node:test";

test("switching locales changes the primary workflow and legal-action copy", async () => {
  const { getMessages } = await import("../lib/i18n/index.ts");

  assert.equal(getMessages("ru").newCase.title, "Загрузите доказательства");
  assert.equal(getMessages("kk").newCase.title, "Дәлелдерді жүктеңіз");
  assert.equal(getMessages("en").newCase.title, "Upload your evidence");
  assert.equal(getMessages("kk").legal.prepare, "Шағымды дайындау");
  assert.equal(getMessages("en").legal.prepare, "Prepare a claim");
  assert.equal(getMessages("kk").timeline.title, "Іс барысы");
  assert.equal(getMessages("en").timeline.title, "Case progress");
});

test("an unknown saved locale cannot break the interface", async () => {
  const { normalizeLocale } = await import("../lib/i18n/index.ts");
  assert.equal(normalizeLocale("kk"), "kk");
  assert.equal(normalizeLocale("en"), "en");
  assert.equal(normalizeLocale("xx"), "ru");
  assert.equal(normalizeLocale(null), "ru");
});

test("the seeded demo returns its explanation in the requested language", async () => {
  const { getDemoCaseAnalysis, getDemoLegalRecommendation, getDemoSellerResponse } = await import("../lib/demo/scenario.ts");
  assert.match(getDemoCaseAnalysis("kk").summary, /құлаққап/);
  assert.match(getDemoLegalRecommendation("en").title, /refund/i);
  assert.match(getDemoSellerResponse("en").summary, /seller/i);
  assert.equal(getDemoLegalRecommendation("en").legalBasis[0].sourceUrl, "https://adilet.zan.kz/rus/docs/Z100000274_");
});

test("generated claim follows the selected language without changing cited provisions", async () => {
  const { composeClaim } = await import("../lib/claim.ts");
  const input = {
    consumer: { name: "Aida", address: "Almaty", phone: "+7 700 000 00 00", email: "aida@example.kz" },
    seller: "Example Electronics", product: "Headphones", amount: 39990, currency: "KZT",
    purchaseDate: "2026-09-12", issue: "Left earbud is defective", remedy: "refund the amount paid",
    legalBasis: [{ lawName: "Закон Республики Казахстан «О защите прав потребителей»", article: "15", sourceUrl: "https://adilet.zan.kz/rus/docs/Z100000274_" }],
  };
  assert.match(composeClaim(input, "en"), /FORMAL CLAIM/);
  assert.match(composeClaim(input, "en"), /Article 15/);
  assert.match(composeClaim(input, "kk"), /ШАҒЫМ/);
  assert.match(composeClaim(input, "kk"), /15-бабына/);
});
