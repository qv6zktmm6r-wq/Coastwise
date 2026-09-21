import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForSync, mergeStates } from './sync';
import { initialState, parseStoredState, type AppState } from './state';
import { getCurrentContentPackVersion } from './jurisdiction';

const syncBaseState: AppState = {
  ...initialState,
  profile: {
    ...initialState.profile,
    jurisdiction: 'US-TX',
    contentPackVersion: getCurrentContentPackVersion('US-TX'),
  },
};

describe('sync helpers', () => {
  it('sanitizes drive logs by removing the entire local review', () => {
    const state: AppState = {
      ...syncBaseState,
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
    assert.equal('notes' in sanitized.sessions[0], false);
    assert.equal(sanitized.sessions[0].minutes, 55);
    assert.doesNotMatch(JSON.stringify(sanitized), /video|coordinates|longitude|latitude/i);
  });

  it('syncs only the explicit AppState contract and excludes local policy records', () => {
    const unsafeState = {
      ...syncBaseState,
      policyAcknowledgements: [{ version: 'local-only' }],
      sessions: [{
        id: 'session-1',
        date: '2026-09-18',
        minutes: 20,
        night: false,
        notes: 'Summary',
        routeTitle: 'Home to school',
        review: {
          id: 'review-1',
          durationSeconds: 120,
          eventCount: 0,
          events: [],
          route: { coordinates: [[-121, 37]], distanceMeters: 1, durationSeconds: 1, origin: [-121, 37], steps: [] },
          videoType: 'video/webm',
        },
      }],
    } as AppState & { policyAcknowledgements: unknown[] };
    const sanitized = sanitizeForSync(unsafeState) as unknown as Record<string, unknown>;
    assert.equal('policyAcknowledgements' in sanitized, false);
    assert.doesNotMatch(JSON.stringify(sanitized), /review-1|coordinates|video\/webm|local-only|Summary|Home to school/i);
  });

  it('merges a cloud drive summary without replacing the local review', () => {
    const localState: AppState = {
      ...syncBaseState,
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
      ...syncBaseState,
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
      ...syncBaseState,
      missions: [{ title: 'Mission 1', detail: '', category: 'Control', minutes: 25, completed: false }],
    };
    const incomingState: AppState = {
      ...syncBaseState,
      missions: [{ title: 'Mission 1', detail: '', category: 'Control', minutes: 25, completed: true }],
    };

    const merged = mergeStates(localState, incomingState as any);
    assert.equal(merged.missions[0].completed, true);
  });

  it('preserves separate drive logs with otherwise identical details', () => {
    const localState: AppState = {
      ...syncBaseState,
      sessions: [
        { id: 'session-1', date: '2026-09-17', minutes: 30, night: false, notes: 'Practice drive' },
        { id: 'session-2', date: '2026-09-17', minutes: 30, night: false, notes: 'Practice drive' },
      ],
    };
    const merged = mergeStates(localState, { ...syncBaseState, sessions: [] } as any);
    assert.deepEqual(merged.sessions.map((session) => session.id).sort(), ['session-1', 'session-2']);
  });

  it('assigns distinct stable IDs when migrating otherwise identical legacy drives', () => {
    const legacy = {
      ...syncBaseState,
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
      ...syncBaseState,
      sessions: [
        { date: '2026-09-17', minutes: 30, night: false, notes: 'Practice drive' },
        { date: '2026-09-17', minutes: 30, night: false, notes: 'Practice drive' },
      ],
    };
    const merged = mergeStates({ ...syncBaseState, sessions: [] }, cloudState as any);
    assert.equal(merged.sessions.length, 2);
    assert.equal(new Set(merged.sessions.map((session) => session.id)).size, 2);
  });

  it('rejects a family state whose jurisdiction and pack version do not match', () => {
    const unsafe = {
      ...initialState,
      profile: {
        ...initialState.profile,
        jurisdiction: 'US-NY' as const,
        contentPackVersion: getCurrentContentPackVersion('US-CA'),
      },
      scenarioAnswers: { 'US-NY:us-ny-2026.09.1:ny-scenario-001': 0 },
    };
    const sanitized = sanitizeForSync(unsafe);
    assert.equal((sanitized.profile as Record<string, unknown>).jurisdiction, 'US-NY');
    assert.equal((sanitized.profile as Record<string, unknown>).contentPackVersion, getCurrentContentPackVersion('US-CA'));
    assert.deepEqual(sanitized.scenarioAnswers, {});
    assert.equal(mergeStates(initialState, sanitized as any), initialState);
  });

  it('keeps scenario answers scoped to the incoming exact jurisdiction and version', () => {
    const local = {
      ...initialState,
      profile: {
        ...initialState.profile,
        jurisdiction: 'US-NY' as const,
        contentPackVersion: getCurrentContentPackVersion('US-NY'),
      },
      scenarioAnswers: { 'US-NY:us-ny-2026.09.1:ny-scenario-001': 1 },
    };
    const incoming = {
      ...local,
      scenarioAnswers: {
        'US-NY:us-ny-2026.09.1:ny-scenario-001': 2,
        'US-CA:us-ca-2026.09.1:ca-scenario-001': 0,
      },
    };
    const merged = mergeStates(local, incoming as any);
    assert.equal(merged.scenarioAnswers['US-NY:us-ny-2026.09.1:ny-scenario-001'], 2);
    assert.equal(merged.scenarioAnswers['US-CA:us-ca-2026.09.1:ca-scenario-001'], undefined);
  });
});
