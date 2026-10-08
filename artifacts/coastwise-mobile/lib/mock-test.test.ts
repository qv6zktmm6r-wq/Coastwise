import assert from 'node:assert/strict';
import test from 'node:test';
import type { MobileDrive } from './coastwise-context.tsx';
import type { TurnScore } from './turn-scores.ts';
import { gradeMockTest, MOCK_TEST_MAX_MISTAKES } from './mock-test.ts';

const cleanTurn: TurnScore = {
  instruction: 'Turn left onto Oak Ave', kind: 'left', completed: true,
  slowed: 'pass', smooth: 'pass', headCheck: 'pass', slowestMph: 12,
};

function mockDrive(overrides: Partial<MobileDrive> = {}): MobileDrive {
  return {
    id: 'mock', date: '2026-10-08T18:00:00.000Z', durationMinutes: 20, distanceMiles: 6, night: false,
    skills: [], mockTest: true, events: [], turnScores: Array.from({ length: 6 }, () => cleanTurn),
    ...overrides,
  };
}

test('a clean measured test is ready', () => {
  const result = gradeMockTest(mockDrive());
  assert.equal(result.outcome, 'ready');
  assert.equal(result.totalMistakes, 0);
});

test('one rolling stop is a critical error', () => {
  const result = gradeMockTest(mockDrive({ events: [{ kind: 'rolling-stop', secondsIntoDrive: 60, speedMph: 8, magnitude: 8 }] }));
  assert.equal(result.outcome, 'keep-practicing');
  assert.equal(result.critical[0].count, 1);
});

test('too many measured mistakes means keep practicing', () => {
  const events = Array.from({ length: MOCK_TEST_MAX_MISTAKES + 1 }, (_, index) => ({ kind: 'hard-brake' as const, secondsIntoDrive: index * 30, speedMph: 20, magnitude: 4 }));
  assert.equal(gradeMockTest(mockDrive({ events })).outcome, 'keep-practicing');
});

test('missed directions and turn misses are counted', () => {
  const result = gradeMockTest(mockDrive({ turnScores: [...mockDrive().turnScores!, { ...cleanTurn, completed: false }, { ...cleanTurn, slowed: 'miss' }] }));
  assert.deepEqual(result.mistakes.map((entry) => entry.label), ['Did not slow to turning speed', 'Did not follow a direction']);
});

test('a short test is not enough to call ready', () => {
  assert.equal(gradeMockTest(mockDrive({ turnScores: [cleanTurn], durationMinutes: 4 })).outcome, 'not-enough-data');
});
