import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNextDrivePlanInput } from './ai-next-drive-plan';
import { initialState, type AppState } from './state';

test('next-drive plan strips identity, notes, answers, video, routes, and coordinates', () => {
  const state: AppState = {
    ...initialState,
    profile: { name: 'Private', permitDate: '2026-01-01', targetTestDate: '2026-12-01' },
    answers: { 1: false },
    missions: [{ title: 'Turns', detail: 'private detail', category: 'Control', minutes: 20, completed: false }],
    sessions: [{
      id: 'private-id',
      date: '2026-09-18',
      minutes: 20,
      night: false,
      notes: 'private family note',
      skills: ['turns'],
      review: {
        id: 'private-review',
        durationSeconds: 1200,
        eventCount: 0,
        events: [],
        videoType: 'video/webm',
        route: { origin: [-121.9, 37.3], coordinates: [[-121.9, 37.3]], distanceMeters: 1, durationSeconds: 1, steps: [] },
      },
    }],
  };
  const input = buildNextDrivePlanInput(state);
  assert.deepEqual(input.unfinishedMissions, [{ title: 'Turns', category: 'Control', minutes: 20 }]);
  assert.deepEqual(input.recentDrives[0]?.skills, ['turns']);
  assert.doesNotMatch(JSON.stringify(input), /private|notes|answer|video|route|coordinate|latitude|longitude|profile|identity|detail/i);
});