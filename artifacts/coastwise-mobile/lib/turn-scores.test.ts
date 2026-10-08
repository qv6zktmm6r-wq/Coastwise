import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreTurn, summarizeTurns, type TurnObservation } from './turn-scores.ts';

const base: TurnObservation = {
  instruction: 'Turn left onto Oak Ave',
  kind: 'left',
  completed: true,
  preparedAt: 0,
  signaledAt: 8_000,
  reachedAt: 12_000,
  speeds: [{ at: 1_000, mph: 30 }, { at: 9_000, mph: 18 }, { at: 12_500, mph: 12 }],
  roughEvents: [],
  headCheck: { reliable: true, headTurns: 1 },
};

test('a slow, smooth turn with a head check passes every check', () => {
  const score = scoreTurn(base);
  assert.deepEqual([score.slowed, score.smooth, score.headCheck, score.slowestMph], ['pass', 'pass', 'pass', 12]);
});

test('a fast turn, hard braking, and no head check are each flagged', () => {
  const score = scoreTurn({
    ...base,
    speeds: [{ at: 1_000, mph: 35 }, { at: 12_000, mph: 27 }],
    roughEvents: [{ at: 11_000, kind: 'hard-brake' }],
    headCheck: { reliable: true, headTurns: 0 },
  });
  assert.deepEqual([score.slowed, score.smooth, score.headCheck], ['miss', 'miss', 'miss']);
});

test('without the driver camera or GPS speed, checks are not measured rather than failed', () => {
  const score = scoreTurn({ ...base, speeds: [], headCheck: null });
  assert.deepEqual([score.slowed, score.headCheck], ['not-measured', 'not-measured']);
  assert.equal(scoreTurn({ ...base, headCheck: { reliable: false, headTurns: 0 } }).headCheck, 'not-measured');
});

test('merges are not graded on turning speed', () => {
  assert.equal(scoreTurn({ ...base, kind: 'merge-right', speeds: [{ at: 12_000, mph: 55 }] }).slowed, 'not-applicable');
});

test('summary counts clean and missed turns', () => {
  const scores = [
    scoreTurn(base),
    scoreTurn({ ...base, headCheck: { reliable: true, headTurns: 0 } }),
    scoreTurn({ ...base, completed: false }),
  ];
  assert.deepEqual(summarizeTurns(scores), { total: 3, completed: 2, clean: 1, missed: 1 });
});
