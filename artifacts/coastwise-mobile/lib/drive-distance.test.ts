import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addDistanceFix,
  distanceMeters,
  METERS_PER_MILE,
  type DistanceFix,
} from './drive-distance.ts';

const start = { latitude: 37.3, longitude: -121.9 };
/** Degrees of latitude per meter, close enough for short test paths. */
const LATITUDE_PER_METER = 1 / 111_195;

function fix(metersNorth: number, seconds: number, accuracyMeters: number | null = 8): DistanceFix {
  return {
    latitude: start.latitude + metersNorth * LATITUDE_PER_METER,
    longitude: start.longitude,
    accuracyMeters,
    timestamp: seconds * 1000,
  };
}

function drive(fixes: DistanceFix[]) {
  let anchor: DistanceFix | null = null;
  let meters = 0;
  for (const next of fixes) {
    const step = addDistanceFix(anchor, next);
    anchor = step.anchor;
    meters += step.meters;
  }
  return meters;
}

test('a mile of steady driving at 30 mph counts as about a mile', () => {
  const metersPerSecond = 13.4;
  const fixes = Array.from({ length: 121 }, (_, second) => fix(second * metersPerSecond, second));
  const miles = drive(fixes) / METERS_PER_MILE;
  assert.ok(Math.abs(miles - 1) < 0.02, `expected about 1 mile, got ${miles}`);
});

test('a parked phone with GPS jitter adds nothing', () => {
  const jitter = [0, 3, -2, 4, -3, 2, -4, 1, 3, -1];
  const fixes = Array.from({ length: 120 }, (_, second) => fix(jitter[second % jitter.length], second));
  assert.equal(drive(fixes), 0);
});

test('slow creeping still counts once it clears GPS noise', () => {
  const fixes = Array.from({ length: 61 }, (_, second) => fix(second * 1.5, second));
  const meters = drive(fixes);
  assert.ok(meters >= 80 && meters <= 90, `expected about 90 meters, got ${meters}`);
});

test('inaccurate fixes are skipped without losing the distance around them', () => {
  const fixes = [fix(0, 0), fix(100, 10, 250), fix(200, 20, null), fix(300, 30)];
  assert.ok(Math.abs(drive(fixes) - 300) < 1);
});

test('an impossible GPS jump is ignored', () => {
  const fixes = [fix(0, 0), fix(2_000, 1), fix(20, 2)];
  assert.ok(Math.abs(drive(fixes) - 20) < 1);
});

test('a long gap restarts measurement instead of guessing the path', () => {
  const fixes = [fix(0, 0), fix(50, 5), fix(1_500, 600), fix(1_550, 605)];
  assert.ok(Math.abs(drive(fixes) - 100) < 1);
});

test('highway speed still counts', () => {
  const metersPerSecond = 31;
  const fixes = Array.from({ length: 60 }, (_, second) => fix(second * metersPerSecond, second));
  assert.ok(Math.abs(drive(fixes) - 59 * metersPerSecond) < 5);
});

test('distanceMeters matches a known distance', () => {
  const meters = distanceMeters(37.3, -121.9, 37.3 + 1_000 * LATITUDE_PER_METER, -121.9);
  assert.ok(Math.abs(meters - 1_000) < 2);
});
