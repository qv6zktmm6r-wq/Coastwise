import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_CALIFORNIA_CONTENT_PACK_VERSION,
  DEFAULT_JURISDICTION,
  hydrateMobileState,
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