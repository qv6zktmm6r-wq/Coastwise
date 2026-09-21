import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_CALIFORNIA_CONTENT_PACK_VERSION,
  DEFAULT_JURISDICTION,
  hydrateMobileState,
  MOBILE_JURISDICTION_LABELS,
} from './mobile-state';

test('fills jurisdiction and pack version for legacy state', () => {
    const state = hydrateMobileState({ drives: [], role: 'teen' });
    assert.equal(state.jurisdiction, DEFAULT_JURISDICTION);
    assert.equal(state.contentPackVersion, CURRENT_CALIFORNIA_CONTENT_PACK_VERSION);
    assert.equal(state.role, 'teen');
});

test('preserves selected jurisdiction and pack version', () => {
    const state = hydrateMobileState({
      drives: [],
      jurisdiction: 'US-CA',
      contentPackVersion: '2026-01-01',
    });
    assert.equal(state.jurisdiction, 'US-CA');
    assert.equal(state.contentPackVersion, CURRENT_CALIFORNIA_CONTENT_PACK_VERSION);
});

test('Today labels cover every registered jurisdiction', () => {
    assert.deepEqual(Object.keys(MOBILE_JURISDICTION_LABELS), ['US-CA', 'US-TX', 'US-FL', 'US-NY', 'US-OH', 'US-IL']);
    assert.deepEqual(Object.values(MOBILE_JURISDICTION_LABELS), ['California', 'Texas', 'Florida', 'New York', 'Ohio', 'Illinois']);
});