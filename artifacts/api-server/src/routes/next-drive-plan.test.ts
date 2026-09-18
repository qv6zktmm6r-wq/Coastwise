import assert from "node:assert/strict";
import test from "node:test";
import {
  allowNextDrivePlanRequest,
  buildNextDrivePlanPrompt,
  containsOnlyNextDrivePlanFields,
} from "./next-drive-plan";

const safeInput = {
  weakTopics: [{ topic: "Right-of-way", mastery: 45 }],
  unfinishedMissions: [{ title: "Smooth starts", category: "Control", minutes: 25 }],
  recentDrives: [{
    durationMinutes: 30,
    night: false,
    skills: ["turns"],
    debriefImprovement: "Prepare earlier.",
    debriefNextStep: "Repeat calm turns.",
  }],
};

test("next-drive plans accept only the privacy-minimized contract", () => {
  assert.equal(containsOnlyNextDrivePlanFields(safeInput), true);
  assert.equal(containsOnlyNextDrivePlanFields({ ...safeInput, identity: "Private" }), false);
  assert.equal(containsOnlyNextDrivePlanFields({
    ...safeInput,
    recentDrives: [{ ...safeInput.recentDrives[0], route: [[-121.9, 37.3]] }],
  }), false);
});

test("next-drive prompt excludes sensitive local fields", () => {
  const prompt = buildNextDrivePlanPrompt(safeInput);
  assert.doesNotMatch(prompt, /coordinate|position|route|recording|video|identity|notes|rawAnswers/i);
  assert.match(prompt, /weakKnowledgeTopics|unfinishedPracticeMissions|recentDriveSummaries/);
});

test("next-drive plan requests are rate limited", () => {
  const clientId = `plan-${Date.now()}`;
  for (let request = 0; request < 10; request += 1) {
    assert.equal(allowNextDrivePlanRequest(clientId, 1_000), true);
  }
  assert.equal(allowNextDrivePlanRequest(clientId, 1_000), false);
});