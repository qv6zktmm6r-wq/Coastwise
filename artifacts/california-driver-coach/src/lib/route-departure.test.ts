import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ROUTE_DEPARTURE_HOLD_MS,
  evaluateRouteDeparture,
  finishRouteDeparture,
  initialRouteDepartureState,
  nearestRouteDistanceMeters,
  routeDepartureCue,
  type RouteDepartureSample,
} from './route-departure';

const line = [
  [-121.9, 37.3],
  [-121.89, 37.3],
] as const;

function sample(overrides: Partial<RouteDepartureSample> = {}): RouteDepartureSample {
  return {
    latitude: 37.3,
    longitude: -121.9,
    now: 1_000,
    coordinates: [...line],
    accuracyMeters: 8,
    movementPlausible: true,
    ...overrides,
  };
}

/** About 200 meters north of a point on the planned line. */
const awayFromLine = sample({ latitude: 37.3018, now: 5_000 });

test('a trusted fix on the planned line stays on route', () => {
  const decision = evaluateRouteDeparture(initialRouteDepartureState, sample());
  assert.equal(decision.action, 'on-route');
  assert.ok(decision.action === 'on-route' && decision.nearestMeters < 1);
  assert.equal(decision.state.offRouteSince, null);
});

test('a trusted fix briefly past the line waits before requesting a return path', () => {
  const first = evaluateRouteDeparture(initialRouteDepartureState, awayFromLine);
  assert.equal(first.action, 'holding');
  assert.equal(first.state.offRouteSince, awayFromLine.now);

  const stillBrief = evaluateRouteDeparture(first.state, {
    ...awayFromLine,
    now: awayFromLine.now + ROUTE_DEPARTURE_HOLD_MS,
  });
  assert.equal(stillBrief.action, 'holding');
  assert.equal(stillBrief.state.offRouteSince, awayFromLine.now);
});

test('a trusted fix past the line long enough requests one return path', () => {
  const holding = evaluateRouteDeparture(initialRouteDepartureState, awayFromLine);
  const decision = evaluateRouteDeparture(holding.state, {
    ...awayFromLine,
    now: awayFromLine.now + ROUTE_DEPARTURE_HOLD_MS + 1,
  });
  assert.equal(decision.action, 'reroute');
  assert.equal(decision.state.rerouting, true);
  if (decision.action === 'reroute') {
    assert.match(decision.cue.detail, /planned line/i);
    assert.doesNotMatch(`${decision.cue.title} ${decision.cue.detail} ${decision.cue.failure}`, /missed turn|hazard|violation|speeding/i);
  }

  const duringRequest = evaluateRouteDeparture(decision.state, {
    ...awayFromLine,
    now: awayFromLine.now + ROUTE_DEPARTURE_HOLD_MS + 2_000,
  });
  assert.deepEqual(duringRequest, { action: 'ignored', reason: 'reroute-in-progress', state: decision.state });
});

test('a failed return keeps the hold so the next trusted fix can try again', () => {
  const holding = evaluateRouteDeparture(initialRouteDepartureState, awayFromLine);
  const requested = evaluateRouteDeparture(holding.state, {
    ...awayFromLine,
    now: awayFromLine.now + ROUTE_DEPARTURE_HOLD_MS + 1,
  });
  const failed = finishRouteDeparture(requested.state, 'failed');
  assert.equal(failed.rerouting, false);
  assert.equal(failed.offRouteSince, awayFromLine.now);

  const retry = evaluateRouteDeparture(failed, {
    ...awayFromLine,
    now: awayFromLine.now + ROUTE_DEPARTURE_HOLD_MS + 2,
  });
  assert.equal(retry.action, 'reroute');
});

test('a successful return clears the hold', () => {
  const holding = evaluateRouteDeparture(initialRouteDepartureState, awayFromLine);
  const requested = evaluateRouteDeparture(holding.state, {
    ...awayFromLine,
    now: awayFromLine.now + ROUTE_DEPARTURE_HOLD_MS + 1,
  });
  const returned = finishRouteDeparture(requested.state, 'returned');
  assert.deepEqual(returned, initialRouteDepartureState);

  const next = evaluateRouteDeparture(returned, {
    ...awayFromLine,
    now: awayFromLine.now + ROUTE_DEPARTURE_HOLD_MS + 2,
  });
  assert.equal(next.action, 'holding');
  assert.equal(next.state.offRouteSince, awayFromLine.now + ROUTE_DEPARTURE_HOLD_MS + 2);
});

test('an untrusted GPS fix does not start, continue, or cancel a departure', () => {
  const loose = evaluateRouteDeparture(initialRouteDepartureState, {
    ...awayFromLine,
    accuracyMeters: 180,
  });
  assert.deepEqual(loose, { action: 'ignored', reason: 'untrusted-fix', state: initialRouteDepartureState });

  const jump = evaluateRouteDeparture(initialRouteDepartureState, {
    ...awayFromLine,
    movementPlausible: false,
  });
  assert.equal(jump.action, 'ignored');

  const holding = evaluateRouteDeparture(initialRouteDepartureState, awayFromLine);
  const noisy = evaluateRouteDeparture(holding.state, {
    ...sample(),
    accuracyMeters: 180,
    now: awayFromLine.now + 4_000,
  });
  assert.equal(noisy.action, 'ignored');
  assert.equal(noisy.state.offRouteSince, awayFromLine.now);

  const back = evaluateRouteDeparture(holding.state, {
    ...sample(),
    now: awayFromLine.now + 4_000,
  });
  assert.equal(back.action, 'on-route');
  assert.equal(back.state.offRouteSince, null);
  assert.equal(back.state.rerouting, false);
});

test('a fix inside its own GPS error does not count as leaving the line', () => {
  const near = evaluateRouteDeparture(initialRouteDepartureState, sample({
    latitude: 37.3009,
    accuracyMeters: 40,
  }));
  assert.equal(near.action, 'on-route');

  const clearlyAway = evaluateRouteDeparture(initialRouteDepartureState, sample({
    latitude: 37.3009,
    accuracyMeters: 8,
  }));
  assert.equal(clearlyAway.action, 'holding');
});

test('nearest distance uses the planned line, including its last point', () => {
  const onLine = nearestRouteDistanceMeters(37.3, -121.89, [...line]);
  assert.ok(onLine < 1);
  const away = nearestRouteDistanceMeters(37.3018, -121.9, [...line]);
  assert.ok(away > 150 && away < 250);
});

test('the drive screen describes a GPS return path and does not claim a missed turn', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /routeDepartureCue/);
  assert.doesNotMatch(app, /missed turn/i);
  assert.match(routeDepartureCue.failure, /return path is unavailable/i);
});
