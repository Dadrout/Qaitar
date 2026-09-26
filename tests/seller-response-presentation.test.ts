import assert from "node:assert/strict";
import test from "node:test";

import { getSellerResponsePresentation } from "../lib/seller-response-presentation.ts";

test("presents every seller-response type without mislabelling it as a refusal", () => {
  assert.equal(getSellerResponsePresentation("accepted").label, "Требование принято");
  assert.equal(getSellerResponsePresentation("rejected").label, "Продавец отказал");
  assert.equal(getSellerResponsePresentation("additional_information_requested").label, "Запрошены документы");
  assert.equal(getSellerResponsePresentation("unclear").label, "Ответ неоднозначен");
  assert.doesNotMatch(getSellerResponsePresentation("unclear").nextTitle, /отказ/i);
  assert.match(getSellerResponsePresentation("rejected").meaningFallback, /не нашёл надёжного правового основания/);
  assert.equal(getSellerResponsePresentation("rejected", "en").label, "Seller refused");
  assert.equal(getSellerResponsePresentation("additional_information_requested", "kk").label, "Құжаттар сұралды");
  assert.equal(getSellerResponsePresentation("no_response").label, "Ответ не получен");
  assert.doesNotMatch(getSellerResponsePresentation("no_response").label, /отказ/i);
  assert.match(getSellerResponsePresentation("no_response").nextTitle, /дату получения/);
});
