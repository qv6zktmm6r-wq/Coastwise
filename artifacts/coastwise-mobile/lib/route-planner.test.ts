import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceGuidance,
  chooseRoute,
  distanceFromRoute,
  initialAdherenceState,
  initialGuidanceState,
  loopWaypoints,
  requestPracticeLoop,
  requestPracticeRoute,
  requestRejoinRoute,
  trackAdherence,
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
  usesFreeway: false,
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

function osrmResponse(steps: Array<{ type: string; modifier?: string; ref?: string; name?: string }>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      code: 'Ok',
      routes: [{
        distance: 4000,
        duration: 500,
        geometry: { coordinates: [[-121.9, 37.3], [-121.9, 37.31]] },
        legs: [{
          steps: steps.map((step, index) => ({
            distance: 200,
            name: step.name ?? `Street ${index}`,
            ref: step.ref,
            maneuver: { type: step.type, modifier: step.modifier, location: [-121.9, 37.3 + index * 0.001] },
          })),
        }],
      }],
    }),
  };
}

test('freeway ramps and Interstates are flagged, and a freeway-free loop is preferred', async () => {
  const responses = [
    osrmResponse([{ type: 'depart' }, { type: 'on ramp', modifier: 'slight right' }, { type: 'merge', modifier: 'slight left', ref: 'I 280' }, { type: 'arrive' }]),
    osrmResponse([{ type: 'depart' }, { type: 'turn', modifier: 'left' }, { type: 'arrive' }]),
  ];
  let calls = 0;
  const chosen = await requestPracticeRoute(37.3, -121.9, 20, 0, { avoidFreeways: true, focus: 'mixed' }, async () => responses[Math.min(calls++, 1)], async () => undefined);
  assert.equal(chosen.usesFreeway, false);
  assert.equal(calls, 2);
});

test('a practice focus picks the loop with the most of that maneuver', () => {
  const withTurns = (kinds: Array<'left' | 'right'>): PlannedRoute => ({
    ...route,
    steps: kinds.map((kind) => ({ instruction: kind, location: route.origin, kind })),
  });
  const best = chooseRoute([withTurns(['right', 'left']), withTurns(['left', 'left', 'left'])], { avoidFreeways: true, focus: 'left' });
  assert.equal(best.steps.length, 3);
});

test('leaving the route is reported only after being on it and staying away', () => {
  const line: PlannedRoute = { ...route, coordinates: [[-121.9, 37.3], [-121.9, 37.31]] };
  const east = (meters: number) => -121.9 + meters / (111_195 * Math.cos(37.3 * Math.PI / 180));
  assert.ok(distanceFromRoute(line, 37.305, east(100)) > 95);

  let result = trackAdherence(initialAdherenceState, 200, 0);
  assert.equal(result.offRoute, false);
  assert.equal(result.state.joined, false);

  result = trackAdherence(result.state, 10, 1000);
  result = trackAdherence(result.state, 100, 2000);
  assert.equal(result.offRoute, false);
  result = trackAdherence(result.state, 100, 9000);
  assert.equal(result.offRoute, true);
});

test('rejoining keeps the turns not yet reached', async () => {
  const rejoin = await requestRejoinRoute(37.31, -121.91, route, 0, async () => osrmResponse([{ type: 'depart' }, { type: 'turn', modifier: 'right', name: 'Elm St' }, { type: 'arrive' }]));
  assert.deepEqual(rejoin.steps.map((step) => step.instruction.split('.')[0]), ['Turn right onto Elm St', 'Turn left onto Oak Ave', 'You are back at the start']);
});

test('examiner mode gives the direction once, with no coaching reminders', () => {
  let result = advanceGuidance(route, initialGuidanceState, 37.3 + 160 * LATITUDE_PER_METER, -121.9, 'examiner');
  assert.match(result.cue ?? '', /^In about \d+ feet, turn left onto Oak Ave\.$/);
  result = advanceGuidance(route, result.state, 37.3 + 250 * LATITUDE_PER_METER, -121.9, 'examiner');
  assert.equal(result.cue, null);
});
