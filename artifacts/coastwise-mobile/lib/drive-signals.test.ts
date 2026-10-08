import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateSignals,
  initialSignalState,
  type DriveSignal,
  type SignalSample,
} from './drive-signals.ts';

function sample(second: number, speed: number | null, heading: number | null = 90, accuracy: number | null = 8): SignalSample {
  return { speedMetersPerSecond: speed, headingDegrees: heading, accuracyMeters: accuracy, timestamp: second * 1000 };
}

function run(samples: SignalSample[]) {
  let state = initialSignalState;
  const signals: DriveSignal[] = [];
  for (const next of samples) {
    const result = evaluateSignals(state, next);
    state = result.state;
    signals.push(...result.signals);
  }
  return signals;
}

const kinds = (signals: DriveSignal[]) => signals.map((signal) => signal.kind);

test('steady cruising produces no events', () => {
  const samples = Array.from({ length: 60 }, (_, second) => sample(second, 13 + (second % 3) * 0.2));
  assert.deepEqual(run(samples), []);
});

test('a gentle stop is a full stop, not a hard brake', () => {
  const speeds = [13, 11.5, 10, 8.5, 7, 5.5, 4, 2.5, 1, 0.2, 0, 0, 0];
  const signals = run(speeds.map((speed, second) => sample(second, speed)));
  assert.deepEqual(kinds(signals), ['full-stop']);
});

test('a sudden drop in speed is a hard brake', () => {
  const speeds = [15, 15, 11, 7, 3, 0, 0, 0];
  const signals = run(speeds.map((speed, second) => sample(second, speed)));
  assert.deepEqual(kinds(signals), ['hard-brake', 'full-stop']);
  assert.ok(Math.abs(signals[0].speedMph - 33.6) < 0.1);
});

test('one hard brake is reported once, not on every reading', () => {
  const speeds = [20, 16, 12, 8, 5];
  assert.deepEqual(kinds(run(speeds.map((speed, second) => sample(second, speed)))), ['hard-brake']);
});

test('a rolling slowdown that never reaches zero is not a full stop', () => {
  const speeds = [12, 9, 6, 3, 1.5, 1.5, 3, 6, 9];
  assert.deepEqual(run(speeds.map((speed, second) => sample(second, speed))), []);
});

test('flooring it from a stop is rapid acceleration', () => {
  const speeds = [0, 0, 3.5, 7, 10.5, 13];
  assert.deepEqual(kinds(run(speeds.map((speed, second) => sample(second, speed)))), ['rapid-acceleration']);
});

test('a fast turn is a sharp turn; the same turn taken slowly is not', () => {
  const fast = [0, 25, 50, 75, 90].map((heading, second) => sample(second, 13, heading));
  assert.deepEqual(kinds(run(fast)), ['sharp-turn']);
  const slow = [0, 15, 30, 45, 60, 75, 90].map((heading, second) => sample(second, 6, heading));
  assert.deepEqual(run(slow), []);
});

test('heading wrap-around at north is handled', () => {
  const signals = run([350, 15, 40].map((heading, second) => sample(second, 13, heading)));
  assert.deepEqual(kinds(signals), ['sharp-turn']);
});

test('inaccurate or missing readings never create events', () => {
  const samples = [sample(0, 15), sample(1, 2, 90, 120), sample(2, null), sample(3, 15)];
  assert.deepEqual(run(samples), []);
});

test('a long gap between readings is not treated as braking', () => {
  assert.deepEqual(kinds(run([sample(0, 15), sample(10, 0), sample(12, 0)])), ['full-stop']);
});

test('a second stop after driving again is reported', () => {
  const speeds = [10, 8, 6, 4, 2, 0, 0, 0, 2, 4, 6, 8, 10, 10, 10, 10, 10, 10, 10, 8, 6, 4, 2, 0, 0, 0];
  const signals = run(speeds.map((speed, second) => sample(second, speed)));
  assert.deepEqual(kinds(signals), ['full-stop', 'full-stop']);
});
