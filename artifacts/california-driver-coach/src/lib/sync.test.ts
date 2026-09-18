import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForSync, mergeStates } from './sync';
import { initialState, parseStoredState, type AppState } from './state';

describe('sync helpers', () => {
  it('sanitizes drive logs by removing the entire local review', () => {
    const state: AppState = {
      ...initialState,
      sessions: [
        {
          id: 'session-1',
          date: '2025-06-01',
          minutes: 55,
          night: false,
          notes: 'Test session',
          review: {
            id: 'rev-1',
            durationSeconds: 120,
            eventCount: 1,
            events: [],
            route: { coordinates: [], distanceMeters: 0, durationSeconds: 0, origin: [0, 0], steps: [] },
            videoType: 'video/webm',
          },
        },
      ],
    };

    const sanitized = sanitizeForSync(state) as unknown as AppState;
    assert.equal(sanitized.sessions[0].review, undefined);
    assert.equal(sanitized.sessions[0].minutes, 55);
    assert.doesNotMatch(JSON.stringify(sanitized), /video|coordinates|longitude|latitude/i);
  });

  it('merges a cloud drive summary without replacing the local review', () => {
    const localState: AppState = {
      ...initialState,
      sessions: [
        {
          id: 'session-1',
          date: '2025-06-01',
          minutes: 55,
          night: false,
          notes: 'Test session',
          review: {
            id: 'rev-1',
            durationSeconds: 120,
            eventCount: 1,
            events: [],
            route: { coordinates: [], distanceMeters: 0, durationSeconds: 0, origin: [0, 0], steps: [] },
            videoType: 'video/webm',
          },
        },
      ],
    };

    const incomingState: AppState = {
      ...initialState,
      sessions: [
        {
          id: 'session-1',
          date: '2025-06-01',
          minutes: 55,
          night: false,
          notes: 'Test session',
        },
      ],
    };

    const merged = mergeStates(localState, incomingState as any);
    assert.equal(merged.sessions.length, 1);
    assert.equal(merged.sessions[0].review?.videoType, 'video/webm');
  });

  it('merges missions successfully', () => {
    const localState: AppState = {
      ...initialState,
      missions: [{ title: 'Mission 1', detail: '', category: 'Control', minutes: 25, completed: false }],
    };
    const incomingState: AppState = {
      ...initialState,
      missions: [{ title: 'Mission 1', detail: '', category: 'Control', minutes: 25, completed: true }],
    };

    const merged = mergeStates(localState, incomingState as any);
    assert.equal(merged.missions[0].completed, true);
  });

  it('preserves separate drive logs with otherwise identical details', () => {
    const localState: AppState = {
      ...initialState,
      sessions: [
        { id: 'session-1', date: '2026-09-17', minutes: 30, night: false, notes: 'Practice drive' },
        { id: 'session-2', date: '2026-09-17', minutes: 30, night: false, notes: 'Practice drive' },
      ],
    };
    const merged = mergeStates(localState, { ...initialState, sessions: [] } as any);
    assert.deepEqual(merged.sessions.map((session) => session.id).sort(), ['session-1', 'session-2']);
  });

  it('assigns distinct stable IDs when migrating otherwise identical legacy drives', () => {
    const legacy = {
      ...initialState,
      sessions: [
        { date: '2026-09-17', minutes: 30, night: false, notes: 'Practice drive' },
        { date: '2026-09-17', minutes: 30, night: false, notes: 'Practice drive' },
      ],
    };
    const first = parseStoredState(JSON.stringify(legacy));
    const second = parseStoredState(JSON.stringify(legacy));
    assert.equal(new Set(first.sessions.map((session) => session.id)).size, 2);
    assert.deepEqual(first.sessions.map((session) => session.id), second.sessions.map((session) => session.id));
  });

  it('preserves every ID-less drive from a legacy cloud document', () => {
    const cloudState = {
      ...initialState,
      sessions: [
        { date: '2026-09-17', minutes: 30, night: false, notes: 'Practice drive' },
        { date: '2026-09-17', minutes: 30, night: false, notes: 'Practice drive' },
      ],
    };
    const merged = mergeStates({ ...initialState, sessions: [] }, cloudState as any);
    assert.equal(merged.sessions.length, 2);
    assert.equal(new Set(merged.sessions.map((session) => session.id)).size, 2);
  });
});
