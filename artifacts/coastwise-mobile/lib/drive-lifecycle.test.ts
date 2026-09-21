import assert from 'node:assert/strict';
import test from 'node:test';
import {
  attachRecording,
  completeDrive,
  DriveLifecycleCoordinator,
  shouldRequestMicrophonePermission,
} from './drive-lifecycle.ts';
import {
  beginDriveState,
  finishDriveState,
  saveDriveState,
  updateDriveState,
} from './mobile-state.ts';
import type { ActiveMobileDrive, MobileState } from './coastwise-context.tsx';

function activeDrive(id = 'drive-1'): ActiveMobileDrive {
  return {
    id,
    date: '2026-09-18T10:00:00.000Z',
    durationMinutes: 1,
    distanceMiles: 2,
    night: false,
    skills: ['turns'],
    startedAt: '2026-09-18T10:00:00.000Z',
    elapsedSeconds: 65,
    recordingRequested: true,
  };
}

test('coordinates recording start, background interruption, parked resume, and stop', async () => {
  const lifecycle = new DriveLifecycleCoordinator();
  const drive = activeDrive();
  const events: string[] = [];
  let persisted: ActiveMobileDrive | null = drive;
  let resolveRecording!: () => void;
  const recordingTask = new Promise<void>((resolve) => {
    resolveRecording = () => {
      events.push('recording:finalized');
      resolve();
    };
  });
  lifecycle.beginDrive();
  lifecycle.beginRecording(recordingTask);
  events.push('recording:start');

  const paused = lifecycle.pause(
    drive,
    72,
    () => events.push('native:stopped'),
    (nextDrive) => {
      persisted = nextDrive;
      events.push('drive:persisted-paused');
    },
  );
  assert.equal(paused?.elapsedSeconds, 72);
  assert.deepEqual(events, ['recording:start', 'native:stopped', 'drive:persisted-paused']);

  const resume = lifecycle.resume(
    () => persisted,
    async () => {
      events.push('native:resumed');
      return true;
    },
    (pending) => events.push(`action:${pending ? 'pending' : 'idle'}`),
  );
  const racingEnd = lifecycle.end(
    () => persisted,
    () => 72,
    () => events.push('native:stopped-for-end'),
    () => events.push('drive:finished-by-race'),
    () => undefined,
  );
  assert.equal(await racingEnd, false);
  assert.equal(events.includes('native:resumed'), false);

  resolveRecording();
  assert.equal(await resume, true);
  assert.deepEqual(events, [
    'recording:start',
    'native:stopped',
    'drive:persisted-paused',
    'action:pending',
    'recording:finalized',
    'native:resumed',
    'action:idle',
  ]);

  const ended = await lifecycle.end(
    () => persisted,
    () => 72,
    () => events.push('native:stopped-for-end'),
    (finished) => {
      persisted = null;
      events.push(`drive:finished:${finished.durationMinutes}`);
    },
    () => undefined,
  );
  assert.equal(ended, true);
  assert.equal(persisted, null);
  assert.deepEqual(events.slice(-2), ['native:stopped-for-end', 'drive:finished:1']);
});

test('process recovery restores an unfinished drive and saves its recording on completion', async () => {
  const lifecycle = new DriveLifecycleCoordinator();
  const recovered = activeDrive();
  let state: MobileState = { drives: [], jurisdiction: 'US-CA', contentPackVersion: '2026-09-18', activeDrive: recovered };
  lifecycle.beginDrive();
  const withRecording = attachRecording(recovered, recovered.id, {
    uri: 'file:///recordings/drive-1.mp4',
    sizeBytes: 4096,
  });
  assert.ok(withRecording);

  state = updateDriveState(state, withRecording as ActiveMobileDrive);
  const ended = await lifecycle.end(
    () => state.activeDrive ?? null,
    () => recovered.elapsedSeconds,
    () => undefined,
    (finished) => {
      state = finishDriveState(state, finished);
    },
    () => undefined,
  );

  assert.equal(ended, true);
  assert.equal(state.activeDrive, undefined);
  assert.equal(state.drives[0]?.id, recovered.id);
  assert.equal(state.drives[0]?.recordingUri, 'file:///recordings/drive-1.mp4');
  assert.equal(state.drives[0]?.recordingSizeBytes, 4096);
});

test('a late recording callback cannot recreate a completed active drive or attach to another drive', () => {
  const first = activeDrive('drive-1');
  let state: MobileState = beginDriveState({ drives: [], jurisdiction: 'US-CA', contentPackVersion: '2026-09-18' }, first);
  state = finishDriveState(state, completeDrive(first, 65));

  const lateUpdate = {
    ...first,
    recordingUri: 'file:///recordings/late.mp4',
    recordingSizeBytes: 2048,
  };
  state = updateDriveState(state, lateUpdate);
  assert.equal(state.activeDrive, undefined);

  const second = activeDrive('drive-2');
  state = beginDriveState(state, second);
  assert.equal(
    attachRecording(second, first.id, { uri: lateUpdate.recordingUri, sizeBytes: 2048 }),
    null,
  );
  state = saveDriveState(state, lateUpdate);
  assert.equal(state.drives.find((drive) => drive.id === second.id)?.recordingUri, undefined);
});

test('discard cannot race a pending resume or end and always stops native tracking', async () => {
  const lifecycle = new DriveLifecycleCoordinator();
  const recovered = activeDrive();
  let current: ActiveMobileDrive | null = recovered;
  let resolveRecording!: () => void;
  const recordingTask = new Promise<void>((resolve) => {
    resolveRecording = resolve;
  });
  lifecycle.beginDrive();
  lifecycle.beginRecording(recordingTask);

  let nativeStarts = 0;
  let nativeStops = 0;
  const resume = lifecycle.resume(
    () => current,
    async () => {
      nativeStarts += 1;
      return true;
    },
    () => undefined,
  );
  const discardedDuringResume = lifecycle.discard(
    () => {
      nativeStops += 1;
    },
    () => {
      current = null;
    },
    () => undefined,
  );
  assert.equal(discardedDuringResume, false);
  assert.equal(current?.id, recovered.id);

  resolveRecording();
  assert.equal(await resume, true);
  assert.equal(nativeStarts, 1);

  const discardAfterResume = lifecycle.discard(
    () => {
      nativeStops += 1;
    },
    () => {
      current = null;
    },
    () => undefined,
  );
  assert.equal(discardAfterResume, true);
  assert.equal(current, null);
  assert.equal(nativeStops, 1);

  lifecycle.beginDrive();
  current = activeDrive('drive-2');
  let resolveSecondRecording!: () => void;
  const secondRecording = new Promise<void>((resolve) => {
    resolveSecondRecording = resolve;
  });
  lifecycle.beginRecording(secondRecording);
  const end = lifecycle.end(
    () => current,
    () => 90,
    () => {
      nativeStops += 1;
    },
    () => {
      current = null;
    },
    () => undefined,
  );
  const discardedDuringEnd = lifecycle.discard(
    () => {
      nativeStops += 1;
    },
    () => {
      current = null;
    },
    () => undefined,
  );
  assert.equal(discardedDuringEnd, false);
  resolveSecondRecording();
  assert.equal(await end, true);
  assert.equal(current, null);
  assert.equal(nativeStops, 2);
});

test('a failed recording task clears and still lets an active drive end and save', async () => {
  const lifecycle = new DriveLifecycleCoordinator();
  const drive = activeDrive();
  let state: MobileState = beginDriveState({ drives: [], jurisdiction: 'US-CA', contentPackVersion: '2026-09-18' }, drive);
  lifecycle.beginDrive();
  lifecycle.beginRecording(Promise.reject(new Error('recording could not be saved')));

  const ended = await lifecycle.end(
    () => state.activeDrive ?? null,
    () => drive.elapsedSeconds,
    () => undefined,
    (finished) => {
      state = finishDriveState(state, finished);
    },
    () => undefined,
  );

  assert.equal(ended, true);
  assert.equal(state.activeDrive, undefined);
  assert.equal(state.drives[0]?.id, drive.id);
  assert.equal(state.drives[0]?.recordingUri, undefined);

  lifecycle.beginDrive();
  state = beginDriveState(state, activeDrive('drive-2'));
  assert.equal(
    await lifecycle.end(
      () => state.activeDrive ?? null,
      () => 90,
      () => undefined,
      (finished) => {
        state = finishDriveState(state, finished);
      },
      () => undefined,
    ),
    true,
  );
  assert.deepEqual(state.drives.map((item) => item.id), ['drive-2', 'drive-1']);
});

test('a failed recording task cannot attach metadata to a recovered replacement drive', async () => {
  const lifecycle = new DriveLifecycleCoordinator();
  const recovered = activeDrive('drive-recovered');
  const replacement = activeDrive('drive-replacement');
  let state: MobileState = beginDriveState({ drives: [], jurisdiction: 'US-CA', contentPackVersion: '2026-09-18' }, recovered);
  lifecycle.beginDrive();
  lifecycle.beginRecording(Promise.reject(new Error('recording metadata unavailable')));

  const ended = await lifecycle.end(
    () => state.activeDrive?.id === recovered.id ? replacement : state.activeDrive ?? null,
    () => replacement.elapsedSeconds,
    () => undefined,
    (finished) => {
      state = finishDriveState(state, finished);
    },
    () => undefined,
  );

  assert.equal(ended, true);
  assert.equal(state.drives[0]?.id, replacement.id);
  assert.equal(state.drives[0]?.recordingUri, undefined);
  assert.equal(state.drives.some((item) => item.recordingUri !== undefined), false);
});

test('denied microphone permission is not requested after drive activation', () => {
  const denied = { granted: false };
  assert.equal(shouldRequestMicrophonePermission(false, denied), true);
  assert.equal(shouldRequestMicrophonePermission(true, denied), false);
  assert.equal(shouldRequestMicrophonePermission(true, undefined), false);
});