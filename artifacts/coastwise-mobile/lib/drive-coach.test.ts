import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseSpokenCue,
  describeEvent,
  initialCoachVoiceState,
  MAX_STORED_EVENTS,
  recordEvent,
  summarizeForDebrief,
} from './drive-coach.ts';
import type { DriveSignal, DriveSignalKind } from './drive-signals.ts';

function signal(kind: DriveSignalKind, second: number): DriveSignal {
  return { kind, at: second * 1000, speedMph: 30, magnitude: 3.5 };
}

test('a measured event is spoken', () => {
  const result = chooseSpokenCue(initialCoachVoiceState, signal('hard-brake', 10));
  assert.match(result.spoken ?? '', /hard stop/);
});

test('cues never stack on top of each other', () => {
  const first = chooseSpokenCue(initialCoachVoiceState, signal('hard-brake', 10));
  const second = chooseSpokenCue(first.state, signal('sharp-turn', 13));
  assert.equal(second.spoken, null);
  const later = chooseSpokenCue(first.state, signal('sharp-turn', 17));
  assert.match(later.spoken ?? '', /turn/);
});

test('praise for full stops is rare', () => {
  const first = chooseSpokenCue(initialCoachVoiceState, signal('full-stop', 10));
  assert.equal(first.spoken, 'Nice full stop.');
  assert.equal(chooseSpokenCue(first.state, signal('full-stop', 60)).spoken, null);
  assert.equal(chooseSpokenCue(first.state, signal('full-stop', 200)).spoken, 'Nice full stop.');
});

test('a correction is not blocked by recent praise', () => {
  const praised = chooseSpokenCue(initialCoachVoiceState, signal('full-stop', 10));
  assert.match(chooseSpokenCue(praised.state, signal('rapid-acceleration', 20)).spoken ?? '', /gas/);
});

test('descriptions name GPS as the source and never claim to see the road', () => {
  for (const kind of ['hard-brake', 'rapid-acceleration', 'sharp-turn', 'full-stop'] as const) {
    const text = describeEvent({ kind, speedMph: 30, magnitude: 3.5 });
    assert.match(text, /^GPS /);
    assert.doesNotMatch(text, /sign|light|camera|saw|see/i);
  }
});

test('map-based events name the map as the source', () => {
  for (const kind of ['stop-sign-complete', 'rolling-stop', 'over-mapped-limit'] as const) {
    const text = describeEvent({ kind, speedMph: 42, magnitude: 7, limitMph: 35 });
    assert.match(text, /^The map shows/);
    assert.doesNotMatch(text, /camera|saw|\bsee\b/i);
  }
  const spoken = chooseSpokenCue(initialCoachVoiceState, { kind: 'over-mapped-limit', at: 0, speedMph: 42.4, magnitude: 7.4, limitMph: 35 });
  assert.equal(spoken.spoken, 'The map shows a 35 limit here. You are at about 42. Ease off.');
});

test('camera-based events are recorded for review but never spoken yet', () => {
  for (const kind of ['camera-rolling-stop', 'close-following', 'no-head-check-before-turn', 'eyes-off-road', 'no-scan-at-stop'] as const) {
    assert.equal(chooseSpokenCue(initialCoachVoiceState, { kind, at: 0, speedMph: 30, magnitude: 1 }).spoken, null);
    assert.match(describeEvent({ kind, speedMph: 30, magnitude: 1 }), /camera/);
  }
  const summary = summarizeForDebrief(recordEvent(undefined, { kind: 'close-following', at: 0, speedMph: 40, magnitude: 1.2 }, 5));
  assert.match(summary[0].detail, /can be wrong/);
});

test('stored events are capped', () => {
  let events = recordEvent(undefined, signal('full-stop', 0), 0);
  for (let index = 1; index < MAX_STORED_EVENTS + 20; index += 1) {
    events = recordEvent(events, signal('full-stop', index), index);
  }
  assert.equal(events.length, MAX_STORED_EVENTS);
});

test('the debrief gets counts only, with no speeds or times', () => {
  let events = recordEvent(undefined, signal('full-stop', 1), 1);
  events = recordEvent(events, signal('full-stop', 50), 50);
  events = recordEvent(events, signal('hard-brake', 80), 80);
  const summary = summarizeForDebrief(events);
  assert.deepEqual(summary.map((event) => event.title), ['Full stop: 2', 'Hard braking: 1']);
  assert.ok(summary.every((event) => !/mph|\d+ ?s\b/.test(event.detail)));
  assert.deepEqual(summarizeForDebrief(undefined), []);
});
