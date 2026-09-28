import assert from "node:assert/strict";
import test from "node:test";

import { analyzeConsumerCase, buildClaimText } from "../lib/case-engine.ts";

test("classifies a warranty refusal and recommends a written claim", () => {
  const result = analyzeConsumerCase({
    description: "Магазин отказал в гарантийном ремонте ноутбука",
    fileNames: ["warranty.pdf", "receipt.jpg"],
  });

  assert.equal(result.category, "warranty_refusal");
  assert.equal(result.nextAction.id, "send_claim");
  assert.ok(result.sources.some((source) => source.article === "Статья 30"));
});

test("uses the core defective-goods path when the evidence is ambiguous", () => {
  const result = analyzeConsumerCase({
    description: "Товар перестал работать через три дня",
    fileNames: ["photo.jpg"],
  });

  assert.equal(result.category, "defective_goods");
  assert.ok(result.confidence >= 0.85);
  assert.match(result.summary, /товар/i);
});

test("builds a ready-to-send claim from extracted facts", () => {
  const claim = buildClaimText({
    consumerName: "Алия С.",
    seller: "ТОО «TechnoDom»",
    product: "Смартфон Samsung Galaxy S24",
    purchaseDate: "12 сентября 2026 года",
    amount: "429 990 ₸",
    issue: "самопроизвольно выключается",
  });

  assert.match(claim, /ТОО «TechnoDom»/);
  assert.match(claim, /429 990 ₸/);
  assert.match(claim, /10 календарных дней/);
});
