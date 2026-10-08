import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateAttention,
  initialAttentionState,
  stopScanVerdict,
  type AttentionEvent,
  type AttentionSample,
  type AttentionState,
  type FaceReading,
} from './driver-attention.ts';

const forward: FaceReading = { visible: true, yawDegrees: 0 };
const turned: FaceReading = { visible: true, yawDegrees: 45 };

type Step = { seconds: number; speed: number; heading: number; face: FaceReading | null };

function run(steps: Step[]) {
  let state: AttentionState = initialAttentionState;
  const events: AttentionEvent[] = [];
  for (const step of steps) {
    const sample: AttentionSample = {
      timestamp: step.seconds * 1000,
      speedMetersPerSecond: step.speed,
      headingDegrees: step.heading,
      face: step.face,
    };
    const result = evaluateAttention(state, sample);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

/** Half-second samples. `headAt(seconds)` returns the face reading at that time. */
function drive(totalSeconds: number, opts: {
  speed?: number;
  heading?: (seconds: number) => number;
  headAt?: (seconds: number) => FaceReading | null;
}) {
  const steps: Step[] = [];
  for (let tenths = 0; tenths <= totalSeconds * 10; tenths += 5) {
    const seconds = tenths / 10;
    steps.push({
      seconds,
      speed: opts.speed ?? 8,
      heading: opts.heading?.(seconds) ?? 0,
      face: opts.headAt ? opts.headAt(seconds) : forward,
    });
  }
  return steps;
}

const rightTurnAt8 = (seconds: number) => (seconds < 8 ? 0 : Math.min(90, (seconds - 8) * 20));
const kinds = (events: AttentionEvent[]) => events.map((event) => event.kind);

test('a head check shortly before a turn is recognized', () => {
  const { events } = run(drive(14, {
    heading: rightTurnAt8,
    headAt: (seconds) => (seconds >= 5 && seconds < 6 ? turned : forward),
  }));
  assert.deepEqual(kinds(events), ['head-check-before-turn']);
});

test('a turn without any head check is flagged', () => {
  const { events } = run(drive(14, { heading: rightTurnAt8 }));
  assert.deepEqual(kinds(events), ['no-head-check-before-turn']);
});

test('a head check long before the turn does not count', () => {
  const { events } = run(drive(14, {
    heading: rightTurnAt8,
    headAt: (seconds) => (seconds >= 0.5 && seconds < 1 ? turned : forward),
  }));
  assert.deepEqual(kinds(events), ['no-head-check-before-turn']);
});

test('looking away for three seconds at speed is eyes off the road', () => {
  const { events } = run(drive(12, {
    speed: 12,
    headAt: (seconds) => (seconds >= 5 && seconds < 8 ? turned : forward),
  }));
  assert.deepEqual(kinds(events), ['eyes-off-road']);
  assert.ok(events[0].magnitude >= 2);
});

test('a one-second mirror glance is fine', () => {
  const { events } = run(drive(12, {
    speed: 12,
    headAt: (seconds) => (seconds >= 5 && seconds < 6 ? turned : forward),
  }));
  assert.deepEqual(events, []);
});

test('a poorly aimed camera that rarely sees the face never judges the driver', () => {
  const { events } = run(drive(14, {
    heading: rightTurnAt8,
    headAt: (seconds) => ({ visible: Math.round(seconds * 2) % 5 === 0, yawDegrees: 0 }),
  }));
  assert.deepEqual(events, []);
});

test('with face tracking off, nothing is evaluated', () => {
  const { events, state } = run(drive(14, { heading: rightTurnAt8, headAt: () => null }));
  assert.deepEqual(events, []);
  assert.equal(state, initialAttentionState);
});

test('scanning at a stop needs two head turns in the seconds before the stop is graded', () => {
  const scanned = run(drive(14, {
    speed: 0,
    headAt: (seconds) => ((seconds >= 6 && seconds < 7) || (seconds >= 9 && seconds < 10) ? turned : forward),
  }));
  assert.deepEqual(stopScanVerdict(scanned.state, 14_000), { scanned: true, headTurns: 2 });
  const glanced = run(drive(14, { speed: 0, headAt: (seconds) => (seconds >= 6 && seconds < 7 ? turned : forward) }));
  assert.deepEqual(stopScanVerdict(glanced.state, 14_000), { scanned: false, headTurns: 1 });
  const unreliable = run(drive(14, { speed: 0, headAt: () => ({ visible: false, yawDegrees: null }) }));
  assert.equal(stopScanVerdict(unreliable.state, 14_000), null);
});
