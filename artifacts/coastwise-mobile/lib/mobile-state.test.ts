import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURRENT_CALIFORNIA_CONTENT_PACK_VERSION,
  DEFAULT_JURISDICTION,
  DETAILED_DRIVES,
  deleteDriveState,
  finishDriveState,
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
test('the permit log keeps every drive; only older drives drop detailed events', () => {
    let state = hydrateMobileState({ drives: [] });
    for (let day = 0; day < DETAILED_DRIVES + 30; day += 1) {
      state = finishDriveState(state, {
        id: `drive-${day}`,
        date: new Date(Date.UTC(2026, 0, 1 + day)).toISOString(),
        durationMinutes: 40,
        distanceMiles: 10,
        night: false,
        skills: [],
        events: [{ kind: 'hard-brake', secondsIntoDrive: 60, speedMph: 20, magnitude: 4 }],
      });
    }
    assert.equal(state.drives.length, DETAILED_DRIVES + 30);
    assert.equal(state.drives.reduce((sum, drive) => sum + drive.durationMinutes, 0), (DETAILED_DRIVES + 30) * 40);
    assert.equal(state.drives[0].id, `drive-${DETAILED_DRIVES + 29}`);
    assert.ok(state.drives[0].events);
    assert.equal(state.drives.at(-1)?.events, undefined);
    assert.equal(deleteDriveState(state, 'drive-0').drives.length, DETAILED_DRIVES + 29);
});
