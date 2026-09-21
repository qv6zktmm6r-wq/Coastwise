import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getJurisdictionPracticeProgress,
  parseStoredState,
  practiceProgressKey,
} from './state';
import {
  CALIFORNIA_CONTENT_PACK_VERSION,
  getCurrentContentPackVersion,
  isSupportedJurisdictionCode,
  supportedJurisdictions,
  type JurisdictionCode,
} from './jurisdiction';

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

test('retains independent progress for every supported state and pack version', () => {
  const jurisdictions: JurisdictionCode[] = ['US-CA', 'US-TX', 'US-FL', 'US-NY', 'US-OH', 'US-IL'];
  const progress = Object.fromEntries(jurisdictions.map((jurisdiction, index) => {
    const version = getCurrentContentPackVersion(jurisdiction);
    return [practiceProgressKey(jurisdiction, version, `question-${index}`), {
      selected: index % 3,
      correct: index % 2 === 0,
      answeredAt: `2026-09-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      attempts: 1,
    }];
  }));

  assert.deepEqual(
    jurisdictions.filter(isSupportedJurisdictionCode),
    supportedJurisdictions.map(({ code }) => code),
  );
  for (const [index, jurisdiction] of jurisdictions.entries()) {
    const version = getCurrentContentPackVersion(jurisdiction);
    assert.deepEqual(
      getJurisdictionPracticeProgress(progress, jurisdiction, version),
      { [`question-${index}`]: progress[practiceProgressKey(jurisdiction, version, `question-${index}`)] },
    );
    assert.deepEqual(getJurisdictionPracticeProgress(progress, jurisdiction, 'us-ca-2026.10.0'), {});
  }
});

test('falls back safely for malformed or unknown stored profiles', () => {
  for (const saved of [
    '{not-json',
    JSON.stringify(null),
    JSON.stringify([]),
    JSON.stringify({ profile: { jurisdiction: 'US-ZZ', contentPackVersion: 'us-zz-2026.09.1' }, practiceProgress: 'nope' }),
    JSON.stringify({ profile: { jurisdiction: 'US-NY', contentPackVersion: 'us-ca-2026.09.1' }, practiceProgress: null }),
  ]) {
    const state = parseStoredState(saved);
    assert.equal(state.profile.jurisdiction, saved.includes('US-NY') ? 'US-NY' : 'US-CA');
    assert.equal(state.profile.contentPackVersion, getCurrentContentPackVersion(state.profile.jurisdiction));
    assert.deepEqual(state.practiceProgress, {});
  }
});

test('hydrates all six known states with their current version', () => {
  const jurisdictions: JurisdictionCode[] = ['US-CA', 'US-TX', 'US-FL', 'US-NY', 'US-OH', 'US-IL'];
  for (const jurisdiction of jurisdictions) {
    const state = parseStoredState(JSON.stringify({
      profile: { jurisdiction, contentPackVersion: 'stale-version' },
      practiceProgress: {},
    }));
    assert.equal(state.profile.jurisdiction, jurisdiction);
    assert.equal(state.profile.contentPackVersion, getCurrentContentPackVersion(jurisdiction));
  }
});