import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeRecording, type RecordingFileSystem } from './recording-finalization.ts';

function fileSystem(overrides: Partial<RecordingFileSystem> = {}): RecordingFileSystem {
  return {
    documentDirectory: 'file:///documents/',
    copyAsync: async () => undefined,
    deleteAsync: async () => undefined,
    getInfoAsync: async () => ({ exists: true, size: 4096 }),
    ...overrides,
  };
}

async function rejectionMessage(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return undefined;
}

test('does not save metadata when camera completion has no URI', async () => {
  let copied = false;
  const result = await finalizeRecording(
    {},
    fileSystem({ copyAsync: async () => { copied = true; } }),
    'coastwise-drive-no-uri.mp4',
  );

  assert.equal(result, null);
  assert.equal(copied, false);
});

test('keeps destinations distinct when recordings finalize in the same millisecond', async () => {
  const originalNow = Date.now;
  const originalRandom = Math.random;
  const copiedDestinations: string[] = [];
  const savedDestinations = new Set<string>();

  Date.now = () => 1_700_000_000_000;
  Math.random = () => 0.5;

  try {
    const storage = fileSystem({
      copyAsync: async ({ to }) => {
        copiedDestinations.push(to);
        savedDestinations.add(to);
      },
      getInfoAsync: async (uri) => ({
        exists: savedDestinations.has(uri),
        size: 4096,
      }),
    });

    const first = await finalizeRecording({ uri: 'file:///cache/first.mp4' }, storage);
    const second = await finalizeRecording({ uri: 'file:///cache/second.mp4' }, storage);

    assert.equal(copiedDestinations.length, 2);
    assert.notEqual(copiedDestinations[0], copiedDestinations[1]);
    assert.deepEqual(new Set([first?.uri, second?.uri]), savedDestinations);
    assert.equal(savedDestinations.size, 2);
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
  }
});

test('does not produce recording metadata when copying the camera file fails', async () => {
  const message = await rejectionMessage(
    () => finalizeRecording(
      { uri: 'file:///cache/camera.mp4' },
      fileSystem({
        copyAsync: async () => {
          throw new Error('storage full');
        },
      }),
      'coastwise-drive-copy-failure.mp4',
    ),
  );

  assert.equal(message, 'storage full');
});

test('removes the copied destination when metadata inspection fails', async () => {
  let deleted = false;
  const message = await rejectionMessage(
    () => finalizeRecording(
      { uri: 'file:///cache/camera.mp4' },
      fileSystem({
        deleteAsync: async (uri, options) => {
          assert.equal(uri, 'file:///documents/coastwise-drive-metadata-failure.mp4');
          assert.deepEqual(options, { idempotent: true });
          deleted = true;
        },
        getInfoAsync: async () => {
          throw new Error('metadata unavailable');
        },
      }),
      'coastwise-drive-metadata-failure.mp4',
    ),
  );

  assert.equal(message, 'metadata unavailable');
  assert.equal(deleted, true);
});

test('reports cleanup failure without replacing the finalization error', async () => {
  const cleanupFailures: Array<{ uri: string; error: unknown }> = [];

  const message = await rejectionMessage(
    () => finalizeRecording(
      { uri: 'file:///cache/camera.mp4' },
      fileSystem({
        deleteAsync: async () => {
          throw new Error('cleanup failed');
        },
        getInfoAsync: async () => {
          throw new Error('metadata unavailable');
        },
      }),
      'coastwise-drive-cleanup-failure.mp4',
      (failure) => {
        cleanupFailures.push(failure);
      },
    ),
  );

  assert.equal(message, 'metadata unavailable');
  assert.equal(cleanupFailures.length, 1);
  assert.equal(cleanupFailures[0]?.uri, 'file:///documents/coastwise-drive-cleanup-failure.mp4');
  assert.equal(
    cleanupFailures[0]?.error instanceof Error ? cleanupFailures[0].error.message : undefined,
    'cleanup failed',
  );
});

test('does not attach metadata when the copied destination is missing', async () => {
  let deleted = false;
  const result = await finalizeRecording(
    { uri: 'file:///cache/camera.mp4' },
    fileSystem({
      deleteAsync: async () => {
        deleted = true;
      },
      getInfoAsync: async () => ({ exists: false }),
    }),
    'coastwise-drive-missing-destination.mp4',
  );

  assert.equal(result, null);
  assert.equal(deleted, true);
});

test('reports cleanup failure when a copied destination cannot be verified or removed', async () => {
  const cleanupFailures: Array<{ uri: string; error: unknown }> = [];
  const result = await finalizeRecording(
    { uri: 'file:///cache/camera.mp4' },
    fileSystem({
      deleteAsync: async () => {
        throw new Error('cleanup failed');
      },
      getInfoAsync: async () => ({ exists: false }),
    }),
    'coastwise-drive-missing-cleanup-failure.mp4',
    (failure) => {
      cleanupFailures.push(failure);
    },
  );

  assert.equal(result, null);
  assert.equal(cleanupFailures.length, 1);
  assert.equal(cleanupFailures[0]?.uri, 'file:///documents/coastwise-drive-missing-cleanup-failure.mp4');
  assert.equal(
    cleanupFailures[0]?.error instanceof Error ? cleanupFailures[0].error.message : undefined,
    'cleanup failed',
  );
});
