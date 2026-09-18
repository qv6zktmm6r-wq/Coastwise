import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForSync, mergeStates } from './sync';
import { initialState, type AppState } from './state';

describe('sync helpers', () => {
  it('sanitizes state by removing videoType from review', () => {
    const state: AppState = {
      ...initialState,
      sessions: [
        {
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
    assert.equal(sanitized.sessions[0].review?.videoType, '');
    assert.equal(sanitized.sessions[0].review?.id, 'rev-1');
  });

  it('merges sessions preferring local videoType', () => {
    const localState: AppState = {
      ...initialState,
      sessions: [
        {
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
            videoType: '',
          },
        },
      ],
    };

    const merged = mergeStates(localState, incomingState as any);
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
});
