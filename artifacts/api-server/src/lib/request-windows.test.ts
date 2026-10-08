import assert from "node:assert/strict";
import test from "node:test";
import { createRequestLimiter } from "./request-windows";

test("limits each client within a window and resets after it", () => {
  const limiter = createRequestLimiter(2, 60_000);
  assert.equal(limiter.allow("a", 0), true);
  assert.equal(limiter.allow("a", 1), true);
  assert.equal(limiter.allow("a", 2), false);
  assert.equal(limiter.allow("b", 2), true);
  assert.equal(limiter.allow("a", 60_000), true);
});

test("expired client windows are pruned", () => {
  const limiter = createRequestLimiter(5, 60_000);
  for (let index = 0; index < 1_500; index += 1) limiter.allow(`client-${index}`, 0);
  limiter.allow("late", 120_000);
  assert.ok(limiter.size < 10, `expected pruning, map has ${limiter.size} entries`);
});
