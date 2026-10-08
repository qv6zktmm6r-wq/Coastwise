import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateManeuvers,
  initialManeuverState,
  matchSpeedLimit,
  type MapEvent,
  type MapSample,
} from './maneuvers.ts';
import { parseMaxspeed, parseOverpass, tileBounds, tileKey, type MapFeatures } from './map-data.ts';

const STOP_LATITUDE = 37.3;
const STOP_LONGITUDE = -121.9;
const LATITUDE_PER_METER = 1 / 111_195;
const LONGITUDE_PER_METER = 1 / (111_320 * Math.cos(STOP_LATITUDE * Math.PI / 180));
const north = (meters: number) => STOP_LATITUDE + meters * LATITUDE_PER_METER;
const east = (meters: number) => STOP_LONGITUDE + meters * LONGITUDE_PER_METER;

/** A side street runs north to a stop sign, then meets a 35 mph east-west road 12 m later. */
const overpassFixture = {
  elements: [
    { type: 'node', id: 1, lat: north(0), lon: east(0), tags: { highway: 'stop' } },
    { type: 'node', id: 2, lat: north(24), lon: east(0), tags: { highway: 'stop' } },
    {
      type: 'way',
      id: 10,
      nodes: [100, 1, 101, 2, 102],
      tags: { highway: 'residential' },
      geometry: [
        { lat: north(-200), lon: east(0) },
        { lat: north(0), lon: east(0) },
        { lat: north(12), lon: east(0) },
        { lat: north(24), lon: east(0) },
        { lat: north(200), lon: east(0) },
      ],
    },
    {
      type: 'way',
      id: 20,
      nodes: [200, 101, 201],
      tags: { highway: 'secondary', maxspeed: '35 mph' },
      geometry: [
        { lat: north(12), lon: east(-500) },
        { lat: north(12), lon: east(0) },
        { lat: north(12), lon: east(500) },
      ],
    },
  ],
};

const features: MapFeatures = parseOverpass(overpassFixture);

function northbound(second: number, metersNorth: number, speed: number, accuracy = 6): MapSample {
  return {
    latitude: north(metersNorth),
    longitude: east(0),
    speedMetersPerSecond: speed,
    headingDegrees: 0,
    accuracyMeters: accuracy,
    timestamp: second * 1000,
  };
}

function eastbound(second: number, metersEast: number, speed: number): MapSample {
  return {
    latitude: north(12),
    longitude: east(metersEast),
    speedMetersPerSecond: speed,
    headingDegrees: 90,
    accuracyMeters: 6,
    timestamp: second * 1000,
  };
}

function run(samples: MapSample[], map = features) {
  let state = initialManeuverState;
  const events: MapEvent[] = [];
  for (const sample of samples) {
    const result = evaluateManeuvers(state, map, sample);
    state = result.state;
    events.push(...result.events);
  }
  return events;
}

const kinds = (events: MapEvent[]) => events.map((event) => event.kind);

function approach(profile: Array<[metersNorth: number, speed: number]>) {
  return profile.map(([meters, speed], second) => northbound(second, meters, speed));
}

test('the overpass response becomes stop signs with approach directions and a speed limit', () => {
  assert.equal(features.stops.length, 2);
  const near = features.stops.find((stop) => stop.id === 'node/1')!;
  assert.equal(near.approachBearings.length, 2);
  assert.ok(near.approachBearings.some((bearing) => bearing < 1 || bearing > 359));
  assert.ok(near.approachBearings.some((bearing) => Math.abs(bearing - 180) < 1));
  assert.deepEqual(features.speedWays.map((way) => way.limitMph), [35]);
});

test('maxspeed tags parse to mph', () => {
  assert.equal(parseMaxspeed('35 mph'), 35);
  assert.equal(parseMaxspeed('50 km/h'), 31);
  assert.equal(parseMaxspeed('25'), null, 'a bare number might mean mph or km/h, so it is not trusted');
  assert.equal(parseMaxspeed('none'), null);
  assert.equal(parseMaxspeed('US:urban'), null);
  assert.equal(parseMaxspeed(undefined), null);
});

test('map squares are coarse and contain the position', () => {
  const key = tileKey(37.31234, -121.95678);
  const bounds = tileBounds(key);
  assert.ok(bounds.south <= 37.31234 && bounds.north >= 37.31234);
  assert.ok(bounds.west <= -121.95678 && bounds.east >= -121.95678);
  assert.ok(bounds.north - bounds.south > 0.02);
  assert.equal(tileKey(37.3101, -121.9501), tileKey(37.3199, -121.9599));
});

test('a complete stop at the mapped stop sign is graded as complete', () => {
  const events = run(approach([
    [-60, 9], [-48, 8], [-40, 7], [-32, 5], [-24, 3.5], [-14, 2], [-6, 0.8], [-3, 0], [-3, 0], [-3, 0],
    [0, 1.5], [6, 3.5], [14, 5], [24, 6], [36, 7], [50, 8],
  ]));
  assert.deepEqual(kinds(events), ['stop-sign-complete']);
});

test('slowing without stopping at the mapped stop sign is a rolling stop', () => {
  const events = run(approach([
    [-60, 9], [-48, 8], [-40, 7], [-32, 5], [-24, 3.5], [-14, 2.5], [-6, 2], [0, 2.2], [6, 3.5], [14, 5], [24, 6], [36, 7],
  ]));
  assert.deepEqual(kinds(events), ['rolling-stop']);
  assert.ok(Math.abs(events[0].speedMph - 4.5) < 0.1);
});

test('cross traffic on the through road is never graded for the side-street stop sign', () => {
  const samples = Array.from({ length: 12 }, (_, second) => eastbound(second, -66 + second * 11, 11));
  assert.deepEqual(run(samples), []);
});

test('passing at speed on the stop sign street is not graded, because the sign may not apply', () => {
  const samples = Array.from({ length: 12 }, (_, second) => northbound(second, -66 + second * 12, 12));
  assert.deepEqual(run(samples), []);
});

test('inaccurate GPS never produces map events', () => {
  const samples = approach([
    [-60, 9], [-48, 8], [-40, 7], [-32, 5], [-24, 3.5], [-14, 2.5], [-6, 2], [0, 2.2], [6, 3.5], [14, 5], [24, 6], [36, 7],
  ]).map((sample) => ({ ...sample, accuracyMeters: 35 }));
  assert.deepEqual(run(samples), []);
});

test('sustained driving well over the mapped limit is reported once a minute at most', () => {
  const metersPerSecond = 45 / 2.236936;
  const samples = Array.from({ length: 20 }, (_, second) => eastbound(second, -300 + second * metersPerSecond / 2, metersPerSecond));
  const events = run(samples);
  assert.deepEqual(kinds(events), ['over-mapped-limit']);
  assert.equal(events[0].limitMph, 35);
  assert.ok(Math.abs(events[0].magnitude - 10) < 0.1);
});

test('a few mph over the mapped limit is not reported', () => {
  const metersPerSecond = 38 / 2.236936;
  const samples = Array.from({ length: 20 }, (_, second) => eastbound(second, -300 + second * 8, metersPerSecond));
  assert.deepEqual(run(samples), []);
});

test('a road crossing at a right angle does not lend its speed limit', () => {
  assert.equal(matchSpeedLimit(features, north(12), east(0), 90), 35);
  assert.equal(matchSpeedLimit(features, north(12), east(0), 0), null);
  assert.equal(matchSpeedLimit(features, north(200), east(300), 90), null);
});
