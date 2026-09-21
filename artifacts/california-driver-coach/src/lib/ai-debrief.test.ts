import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDriveDebriefInput } from './ai-debrief';
import { initialState, type DriveSession } from './state';

test('AI debrief request strips local review, route, position, speed, and identity data', () => {
  const session: DriveSession = {
    id: 'private-session-id',
    date: '2026-09-18',
    minutes: 30,
    night: false,
    notes: 'private family note',
    distanceMiles: 7.5,
    skills: ['turns'],
    review: {
      id: 'private-review-id',
      durationSeconds: 1_800,
      eventCount: 1,
      videoType: 'video/webm',
      events: [],
      route: {
        origin: [-121.9, 37.3],
        coordinates: [[-121.9, 37.3]],
        distanceMeters: 1_000,
        durationSeconds: 1_800,
        steps: [],
      },
    },
  };
  const input = buildDriveDebriefInput({
    session,
    elapsedSeconds: 1_800,
    distanceMiles: 99,
    plannedSkills: ['parking'],
    events: [{
      id: 'private-event-id',
      timestamp: 12,
      kind: 'maneuver',
      title: 'Turn announced',
      detail: 'Prepare early.',
      speedMph: 22,
      position: [-121.8, 37.4],
      distanceToNext: 10,
      stepIndex: 2,
    }],
    topics: initialState.topics,
    jurisdiction: 'US-NY',
    contentPackVersion: 'us-ny-2026.09.1',
  });

  assert.deepEqual(input.events, [{ kind: 'maneuver', title: 'Turn announced', detail: 'Prepare early.' }]);
  assert.equal(input.distanceMiles, 7.5);
  assert.equal(input.jurisdiction, 'US-NY');
  assert.equal(input.contentPackVersion, 'us-ny-2026.09.1');
  assert.deepEqual(input.skills, ['turns']);
  assert.doesNotMatch(
    JSON.stringify(input),
    /private|position|speedMph|route|coordinate|video|latitude|longitude|notes|review/i,
  );
});