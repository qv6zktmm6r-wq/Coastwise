import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getJurisdictionPracticeProgress,
  parseStoredState,
  practiceProgressKey,
} from './state';
import { CALIFORNIA_CONTENT_PACK_VERSION } from './jurisdiction';

test('migrates legacy California state without losing practice progress', () => {
  const state = parseStoredState(JSON.stringify({
    profile: { name: 'Avery', permitDate: '2026-01-02', targetTestDate: '2026-07-02' },
    practiceProgress: {
      'licensing-001': { selected: 0, correct: true, answeredAt: '2026-09-01T00:00:00.000Z', attempts: 1 },
    },
    sessions: [],
  }));
  assert.equal(state.profile.jurisdiction, 'US-CA');
  assert.equal(state.profile.contentPackVersion, CALIFORNIA_CONTENT_PACK_VERSION);
  assert.equal(state.practiceProgress[`US-CA:${CALIFORNIA_CONTENT_PACK_VERSION}:licensing-001`]?.correct, true);
});

test('isolates practice progress by jurisdiction key', () => {
  const progress = {
    [practiceProgressKey('US-CA', CALIFORNIA_CONTENT_PACK_VERSION, 'licensing-001')]: {
      selected: 0,
      correct: true,
      answeredAt: '2026-09-01T00:00:00.000Z',
      attempts: 1,
    },
    'US-TX:us-tx-2026.09.1:tx-licensing-001': {
      selected: 1,
      correct: false,
      answeredAt: '2026-09-02T00:00:00.000Z',
      attempts: 1,
    },
  };
  assert.deepEqual(
    Object.keys(getJurisdictionPracticeProgress(progress, 'US-CA', CALIFORNIA_CONTENT_PACK_VERSION)),
    ['licensing-001'],
  );
});

test('isolates practice progress across pack versions in the same jurisdiction', () => {
  const progress = {
    [practiceProgressKey('US-TX', 'us-tx-2026.09.1', 'tx-signs-001')]: {
      selected: 0,
      correct: true,
      answeredAt: '2026-09-01T00:00:00.000Z',
      attempts: 1,
    },
    [practiceProgressKey('US-TX', 'us-tx-2026.10.0', 'tx-signs-001')]: {
      selected: 1,
      correct: false,
      answeredAt: '2026-10-01T00:00:00.000Z',
      attempts: 1,
    },
  };
  assert.equal(getJurisdictionPracticeProgress(progress, 'US-TX', 'us-tx-2026.09.1')['tx-signs-001']?.correct, true);
  assert.equal(getJurisdictionPracticeProgress(progress, 'US-TX', 'us-tx-2026.10.0')['tx-signs-001']?.correct, false);
});