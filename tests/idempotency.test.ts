import test from "node:test";
import assert from "node:assert/strict";
import { createOrderIdempotencyKey, InMemoryIdempotencyStore } from "../src/security/idempotency";

test("idempotency key is stable for the same logical order", () => {
  const input = { accountId: "a", proposalId: "p", symbol: "AAPL", side: "BUY" };
  assert.equal(createOrderIdempotencyKey(input), createOrderIdempotencyKey(input));
});

test("duplicate order keys are rejected until released or expired", () => {
  const store = new InMemoryIdempotencyStore(1000);
  assert.equal(store.claim("same", 1000), true);
  assert.equal(store.claim("same", 1500), false);
  assert.equal(store.claim("same", 2001), true);
  store.release("same");
  assert.equal(store.claim("same", 2002), true);
});
