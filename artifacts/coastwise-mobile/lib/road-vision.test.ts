import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateDistanceMeters,
  evaluateVision,
  initialVisionState,
  type Detection,
  type VisionEvent,
  type VisionFrame,
} from './road-vision.ts';

const stopSign = (width: number, x = 0.7, confidence = 0.8): Detection => ({ label: 'stop sign', confidence, x, y: 0.3, width, height: width });
const car = (width: number, x = 0.5 - width / 2, confidence = 0.8): Detection => ({ label: 'car', confidence, x, y: 0.5, width, height: width * 0.6 });

function frame(tenths: number, speed: number | null, ...detections: Detection[]): VisionFrame {
  return { timestamp: tenths * 100, speedMetersPerSecond: speed, detections };
}

function run(frames: VisionFrame[]) {
  let state = initialVisionState;
  const events: VisionEvent[] = [];
  for (const next of frames) {
    const result = evaluateVision(state, next);
    state = result.state;
    events.push(...result.events);
  }
  return events;
}

const kinds = (events: VisionEvent[]) => events.map((event) => event.kind);

/** Approach a sign that grows in view, then slow to `slowest`, then drive away. */
function signApproach(slowest: number) {
  const frames: VisionFrame[] = [];
  let t = 0;
  const widths = [0.03, 0.035, 0.04, 0.05, 0.06, 0.07];
  for (const width of widths) frames.push(frame(t += 5, 8, stopSign(width)));
  for (const speed of [6, 4, 2, slowest, slowest, slowest]) frames.push(frame(t += 5, speed));
  for (const speed of [2, 4, 6, 7, 8]) frames.push(frame(t += 5, speed));
  return frames;
}

test('a stop sign seen growing in view, then a full stop, is a complete stop', () => {
  assert.deepEqual(kinds(run(signApproach(0))), ['camera-stop-complete']);
});

test('a stop sign seen, then slowing without stopping, is a rolling stop', () => {
  const events = run(signApproach(1.5));
  assert.deepEqual(kinds(events), ['camera-rolling-stop']);
  assert.ok(Math.abs(events[0].speedMph - 3.4) < 0.1);
});

test('a single-frame stop sign blip is ignored', () => {
  const frames = [frame(1, 8, stopSign(0.05)), frame(30, 8), frame(60, 1), frame(90, 8), frame(120, 8)];
  assert.deepEqual(run(frames), []);
});

test('a stop sign on the left side of the view is not treated as ours', () => {
  const frames = signApproach(1.5).map((next) => ({
    ...next,
    detections: next.detections.map((detection) => ({ ...detection, x: 0.1 })),
  }));
  assert.deepEqual(run(frames), []);
});

test('low-confidence detections are ignored', () => {
  const frames = signApproach(1.5).map((next) => ({
    ...next,
    detections: next.detections.map((detection) => ({ ...detection, confidence: 0.3 })),
  }));
  assert.deepEqual(run(frames), []);
});

test('a sign that never gets closer is not confirmed', () => {
  const frames: VisionFrame[] = [];
  for (let t = 1; t <= 6; t += 1) frames.push(frame(t * 5, 8, stopSign(0.04)));
  frames.push(frame(40, 1.5), frame(70, 6), frame(100, 8));
  assert.deepEqual(run(frames), []);
});

test('distance estimate from apparent car width', () => {
  const meters = estimateDistanceMeters(0.1)!;
  assert.ok(meters > 13 && meters < 16, `got ${meters}`);
  assert.equal(estimateDistanceMeters(0), null);
});

test('following closely at speed for several seconds is tagged once', () => {
  const frames: VisionFrame[] = [];
  for (let tenths = 0; tenths <= 60; tenths += 5) frames.push(frame(tenths, 25, car(0.12)));
  const events = run(frames);
  assert.deepEqual(kinds(events), ['close-following']);
  assert.ok(events[0].magnitude < 1, `gap ${events[0].magnitude}`);
});

test('a comfortable gap, a car in another lane, or slow traffic is not tagged', () => {
  const comfortable = Array.from({ length: 13 }, (_, index) => frame(index * 5, 25, car(0.02)));
  assert.deepEqual(run(comfortable), []);
  const otherLane = Array.from({ length: 13 }, (_, index) => frame(index * 5, 25, car(0.12, 0.75)));
  assert.deepEqual(run(otherLane), []);
  const slowTraffic = Array.from({ length: 13 }, (_, index) => frame(index * 5, 5, car(0.2)));
  assert.deepEqual(run(slowTraffic), []);
});

test('a brief close moment under three seconds is not tagged', () => {
  const frames = [frame(0, 25, car(0.12)), frame(10, 25, car(0.12)), frame(20, 25, car(0.02)), frame(30, 25, car(0.02))];
  assert.deepEqual(run(frames), []);
});
