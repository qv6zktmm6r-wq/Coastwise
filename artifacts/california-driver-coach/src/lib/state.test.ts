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
  assert.equal(state.practiceProgress['US-CA:licensing-001']?.correct, true);
});

test('isolates practice progress by jurisdiction key', () => {
  const progress = {
    [practiceProgressKey('US-CA', 'licensing-001')]: {
      selected: 0,
      correct: true,
      answeredAt: '2026-09-01T00:00:00.000Z',
      attempts: 1,
    },
    'US-TX:licensing-001': {
      selected: 1,
      correct: false,
      answeredAt: '2026-09-02T00:00:00.000Z',
      attempts: 1,
    },
  };
  assert.deepEqual(Object.keys(getJurisdictionPracticeProgress(progress, 'US-CA')), ['licensing-001']);
});