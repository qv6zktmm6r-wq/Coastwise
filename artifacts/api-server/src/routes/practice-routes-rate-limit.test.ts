import assert from "node:assert/strict";
import test from "node:test";
import { allowRouteRequest } from "./practice-routes";

test("limits repeated route requests from one client", () => {
  const clientId = `rate-limit-${Date.now()}`;
  for (let request = 0; request < 20; request += 1) {
    assert.equal(allowRouteRequest(clientId, 1_000), true);
  }
  assert.equal(allowRouteRequest(clientId, 1_000), false);
  assert.equal(allowRouteRequest(clientId, 61_001), true);
});