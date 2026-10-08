import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActiveMobileDrive, MobileDrive } from './coastwise-context.tsx';
import type { DriveEventKind, DriveEventRecord } from './drive-coach.ts';
import { completeDrive } from './drive-lifecycle.ts';
import { nextFocus, permitProgress, PRACTICE_REQUIREMENTS, skillTrends } from './permit-progress.ts';

function drive(overrides: Partial<MobileDrive> = {}): MobileDrive {
  return {
    id: overrides.id ?? `drive-${Math.random()}`,
    date: '2026-10-01T18:00:00.000Z',
    durationMinutes: 60,
    distanceMiles: 20,
    night: false,
    skills: ['turns'],
    ...overrides,
  };
}

function events(...kinds: DriveEventKind[]): DriveEventRecord[] {
  return kinds.map((kind, index) => ({ kind, secondsIntoDrive: index * 30, speedMph: 25, magnitude: 1 }));
}

test('requirements match the approved state records', () => {
  assert.deepEqual(PRACTICE_REQUIREMENTS['US-CA'], { totalHours: 50, nightHours: 10, nightLabel: 'at night' });
  assert.equal(PRACTICE_REQUIREMENTS['US-TX'].totalHours, 30);
  assert.equal(PRACTICE_REQUIREMENTS['US-NY'].nightHours, 15);
});

test('measured night minutes count exactly; older drives fall back to the night flag', () => {
  const progress = permitProgress([
    drive({ durationMinutes: 60, nightMinutes: 20 }),
    drive({ durationMinutes: 30, night: true }),
    drive({ durationMinutes: 45, night: false }),
  ], 'US-CA');
  assert.equal(progress.totalMinutes, 135);
  assert.equal(progress.nightMinutes, 50);
  assert.equal(progress.totalComplete, false);
});

test('completing a drive turns night seconds into night minutes', () => {
  const active = (nightSeconds: number): ActiveMobileDrive => ({
    ...drive(),
    startedAt: '2026-10-01T18:00:00.000Z',
    elapsedSeconds: 1_800,
    nightSeconds,
  });
  const finished = completeDrive(active(1_200), 1_800);
  assert.equal(finished.durationMinutes, 30);
  assert.equal(finished.nightMinutes, 20);
  assert.equal(finished.night, true);
  assert.equal('nightSeconds' in finished, false);
  const daytime = completeDrive(active(0), 1_800);
  assert.equal(daytime.nightMinutes, 0);
  assert.equal(daytime.night, false);
});

test('skill trends use measured drives only and say so plainly', () => {
  const result = skillTrends([
    drive({ distanceMiles: 10, events: events('stop-sign-complete', 'stop-sign-complete', 'rolling-stop', 'hard-brake') }),
    drive({ distanceMiles: 10, events: events('stop-sign-complete') }),
    drive({ distanceMiles: 50 }),
  ]);
  assert.equal(result.drivesConsidered, 2);
  assert.equal(result.miles, 20);
  const stops = result.trends.find((trend) => trend.id === 'stop-signs')!;
  assert.equal(stops.summary, '3 of 4 mapped stop signs had a complete stop.');
  const braking = result.trends.find((trend) => trend.id === 'braking')!;
  assert.equal(braking.summary, '1 hard brake in 20.0 miles.');
});

test('no measured evidence means no claims and no focus', () => {
  const result = skillTrends([drive()]);
  assert.equal(result.drivesConsidered, 0);
  assert.ok(result.trends.every((trend) => trend.summary === null));
  assert.equal(nextFocus(result.trends), null);
});

test('the next focus is the skill with the most measured concern', () => {
  const result = skillTrends([
    drive({ distanceMiles: 10, events: events('rolling-stop', 'rolling-stop', 'stop-sign-complete', 'hard-brake') }),
  ]);
  assert.equal(nextFocus(result.trends)?.id, 'stop-signs');
  const clean = skillTrends([drive({ distanceMiles: 10, events: events('stop-sign-complete') })]);
  assert.equal(nextFocus(clean.trends), null);
});
