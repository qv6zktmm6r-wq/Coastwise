import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitivePath } from "./lib/request-logging";

test("redacts family invite tokens from request log paths", () => {
  assert.equal(
    redactSensitivePath("/api/families/invites/secret-token/accept"),
    "/api/families/invites/[REDACTED]/accept",
  );
  assert.equal(
    redactSensitivePath("/api/families/invites/secret-token"),
    "/api/families/invites/[REDACTED]",
  );
  assert.equal(
    redactSensitivePath("/api/families/sync"),
    "/api/families/sync",
  );
});
