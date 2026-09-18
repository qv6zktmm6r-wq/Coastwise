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
    'coastwise-drive-test.mp4',
  );

  assert.equal(result, null);
  assert.equal(copied, false);
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

test('does not produce recording metadata when destination inspection fails', async () => {
  const deleted: Array<{ uri: string; options?: { idempotent?: boolean } }> = [];
  const message = await rejectionMessage(
    () => finalizeRecording(
      { uri: 'file:///cache/camera.mp4' },
      fileSystem({
        deleteAsync: async (uri, options) => {
          deleted.push({ uri, options });
        },
        getInfoAsync: async () => {
          throw new Error('metadata unavailable');
        },
      }),
      'coastwise-drive-metadata-failure.mp4',
    ),
  );
  assert.equal(message, 'metadata unavailable');
  assert.deepEqual(deleted, [{
    uri: 'file:///documents/coastwise-drive-metadata-failure.mp4',
    options: { idempotent: true },
  }]);
});

test('does not replace metadata failure when cleanup also fails', async () => {
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
    ),
  );

  assert.equal(message, 'metadata unavailable');
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