import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceGuidance,
  initialGuidanceState,
  loopWaypoints,
  requestPracticeLoop,
  type PlannedRoute,
} from './route-planner.ts';

const LATITUDE_PER_METER = 1 / 111_195;

test('each variant produces a different loop that starts and ends at the origin', () => {
  const first = loopWaypoints(37.3, -121.9, 20, 0);
  const second = loopWaypoints(37.3, -121.9, 20, 1);
  assert.deepEqual(first[0], [-121.9, 37.3]);
  assert.deepEqual(first.at(-1), [-121.9, 37.3]);
  assert.notDeepEqual(first.slice(1, -1), second.slice(1, -1));
});

test('the routing service only receives a rounded starting point', async () => {
  let requested = '';
  const route = await requestPracticeLoop(37.123456, -121.987654, 20, 0, async (url) => {
    requested = url;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        routes: [{
          distance: 5000,
          duration: 600,
          geometry: { coordinates: [[-121.988, 37.123], [-121.98, 37.13]] },
          legs: [{
            steps: [
              { distance: 0, name: 'Main St', maneuver: { type: 'depart', location: [-121.988, 37.123] } },
              { distance: 400, name: 'Oak Ave', maneuver: { type: 'turn', modifier: 'left', location: [-121.985, 37.125] } },
              { distance: 0, maneuver: { type: 'arrive', location: [-121.988, 37.123] } },
            ],
          }],
        }],
      }),
    };
  });
  assert.ok(requested.includes('-121.98800,37.12300'));
  assert.ok(!requested.includes('37.123456'));
  assert.deepEqual(route.steps.map((step) => step.instruction.split('.')[0]), ['Turn left onto Oak Ave', 'You are back at the start']);
});

const route: PlannedRoute = {
  coordinates: [],
  distanceMeters: 1000,
  durationSeconds: 120,
  origin: [-121.9, 37.3],
  steps: [
    { instruction: 'Turn left onto Oak Ave', location: [-121.9, 37.3 + 300 * LATITUDE_PER_METER], kind: 'left' },
    { instruction: 'You are back at the start.', location: [-121.9, 37.3], kind: 'arrive' },
  ],
};

test('prepares early, then calls the signal and head check close to the turn', () => {
  let result = advanceGuidance(route, initialGuidanceState, 37.3, -121.9);
  assert.equal(result.cue, null);
  assert.equal(result.nextInstruction, 'Turn left onto Oak Ave');

  result = advanceGuidance(route, result.state, 37.3 + 160 * LATITUDE_PER_METER, -121.9);
  assert.match(result.cue ?? '', /^In about \d+ feet, turn left onto Oak Ave\. Check your mirrors/);
  result = advanceGuidance(route, result.state, 37.3 + 170 * LATITUDE_PER_METER, -121.9);
  assert.equal(result.cue, null);

  result = advanceGuidance(route, result.state, 37.3 + 250 * LATITUDE_PER_METER, -121.9);
  assert.match(result.cue ?? '', /^Signal left now\. .*left shoulder/);
  result = advanceGuidance(route, result.state, 37.3 + 260 * LATITUDE_PER_METER, -121.9);
  assert.equal(result.cue, null);

  result = advanceGuidance(route, result.state, 37.3 + 295 * LATITUDE_PER_METER, -121.9);
  assert.equal(result.state.stepIndex, 1);

  result = advanceGuidance(route, result.state, 37.3 + 20 * LATITUDE_PER_METER, -121.9);
  assert.equal(result.cue, 'You are back at the start.');
});

test('a merge right calls out the right mirror and blind spot', () => {
  const merge: PlannedRoute = {
    ...route,
    steps: [{ instruction: 'Merge right onto I-280', location: route.steps[0].location, kind: 'merge-right' }],
  };
  const near = advanceGuidance(merge, initialGuidanceState, 37.3 + 260 * LATITUDE_PER_METER, -121.9);
  assert.match(near.cue ?? '', /^Merge right onto I-280\. Signal right now\. .*right blind spot/);
});

test('does not finish the loop at the very start', () => {
  const finishOnly: PlannedRoute = { ...route, steps: [route.steps[1]] };
  assert.equal(advanceGuidance(finishOnly, initialGuidanceState, 37.3, -121.9).cue, null);
});
