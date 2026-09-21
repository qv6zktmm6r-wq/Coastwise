import assert from "node:assert/strict";
import test from "node:test";
import {
  allowDebriefRequest,
  buildDebriefPrompt,
  containsOnlyDebriefFields,
  approvedPackVersions,
} from "./drive-debrief";

const safeInput = {
  jurisdiction: "US-CA" as const,
  contentPackVersion: "2026-01",
  durationMinutes: 30,
  distanceMiles: 8.2,
  night: false,
  skills: ["turns"],
  events: [{ kind: "maneuver" as const, title: "Turn announced", detail: "Prepare early." }],
  weakTopics: [{ topic: "Right-of-way", mastery: 45 }],
};

test("AI debrief accepts only the privacy-minimized contract", () => {
  assert.equal(containsOnlyDebriefFields(safeInput), true);
  assert.equal(containsOnlyDebriefFields({ ...safeInput, video: "blob" }), false);
  assert.equal(containsOnlyDebriefFields({
    ...safeInput,
    events: [{ ...safeInput.events[0], position: [-121.9, 37.3] }],
  }), false);
  assert.equal(containsOnlyDebriefFields({
    ...safeInput,
    weakTopics: [{ ...safeInput.weakTopics[0], userName: "Private" }],
  }), false);
});

test("AI prompt contains no route, video, position, or recording fields", () => {
  const prompt = buildDebriefPrompt(safeInput);
  assert.doesNotMatch(prompt, /coordinate|position|route|recording|video/i);
  assert.match(prompt, /jurisdiction|contentPackVersion|durationMinutes|observedCoachEvents|weakKnowledgeTopics/);
  assert.match(prompt, /US-CA|2026-01/);
});

test("AI debrief requests are rate limited per client", () => {
  const clientId = `debrief-${Date.now()}`;
  for (let request = 0; request < 10; request += 1) {
    assert.equal(allowDebriefRequest(clientId, 1_000), true);
  }
  assert.equal(allowDebriefRequest(clientId, 1_000), false);
  assert.equal(allowDebriefRequest(clientId, 61_001), true);
});

test("rejects the superseded Florida pack while accepting the DETS correction", () => {
  assert.equal(approvedPackVersions["US-FL"], "us-fl-2026.09.2");
  assert.notEqual(approvedPackVersions["US-FL"], "us-fl-2026.09.1");
});