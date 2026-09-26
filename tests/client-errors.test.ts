import assert from "node:assert/strict";
import test from "node:test";

import { validateSellerResponseDraft } from "../lib/seller-response-input.ts";

test("seller response file validation uses the active locale", () => {
  const invalid = new File(["x"], "reply.exe", { type: "application/octet-stream" });
  const large = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "reply.pdf", { type: "application/pdf" });
  const empty = new File([], "reply.pdf", { type: "application/pdf" });

  assert.deepEqual(validateSellerResponseDraft({ mode: "file", file: invalid }, "en"), { ok: false, error: "This file format is not supported" });
  assert.deepEqual(validateSellerResponseDraft({ mode: "file", file: large }, "kk"), { ok: false, error: "Файл 10 МБ-тан үлкен" });
  assert.deepEqual(validateSellerResponseDraft({ mode: "file", file: empty }, "en"), { ok: false, error: "The file is empty" });
});

test("client request errors map known seller responses and hide raw failures", async () => {
  const { ClientRequestError, getClientErrorMessage } = await import("../lib/client-errors.ts");
  assert.equal(
    getClientErrorMessage("seller", "en", new ClientRequestError(400, "Срок ответа продавца ещё не истёк")),
    "The seller response period has not yet ended",
  );
  assert.equal(
    getClientErrorMessage("seller", "kk", new ClientRequestError(400, "Дата получения претензии не может предшествовать дате направления. Проверьте обе даты.")),
    "Алған күн жіберілген күннен бұрын болмауы керек",
  );
  assert.equal(
    getClientErrorMessage("seller", "en", new ClientRequestError(502, "Private provider key leaked")),
    "The analysis service is temporarily unavailable. Please try again.",
  );
  assert.equal(
    getClientErrorMessage("claim", "en", new Error("TypeError: internal server path")),
    "Could not prepare the claim. Please try again.",
  );
});
