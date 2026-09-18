export type CameraRecordingResult = {
  uri?: string | null;
} | null | undefined;

export type RecordingFileSystem = {
  documentDirectory?: string | null;
  copyAsync: (options: { from: string; to: string }) => Promise<void>;
  deleteAsync: (uri: string, options?: { idempotent?: boolean }) => Promise<void>;
  getInfoAsync: (uri: string) => Promise<{
    exists: boolean;
    size?: number | null;
    modificationTime?: number;
  }>;
};

export type FinalizedRecording = {
  uri: string;
  sizeBytes: number;
  modifiedAt?: number;
};

export type RecordingCleanupFailure = {
  uri: string;
  error: unknown;
};

let lastDestinationTimestamp = -1;
let destinationSequence = 0;

function createDestinationName() {
  const timestamp = Date.now();
  destinationSequence = timestamp === lastDestinationTimestamp ? destinationSequence + 1 : 0;
  lastDestinationTimestamp = timestamp;
  const uniqueSuffix = Math.random().toString(36).slice(2, 11);
  return `coastwise-drive-${timestamp}-${destinationSequence}-${uniqueSuffix}.mp4`;
}

export async function finalizeRecording(
  result: CameraRecordingResult,
  fileSystem: RecordingFileSystem,
  destinationName = createDestinationName(),
  onCleanupFailure?: (failure: RecordingCleanupFailure) => void,
): Promise<FinalizedRecording | null> {
  if (!result?.uri || !fileSystem.documentDirectory) return null;

  const destination = `${fileSystem.documentDirectory}${destinationName}`;
  await fileSystem.copyAsync({ from: result.uri, to: destination });

  const cleanupDestination = async () => {
    try {
      await fileSystem.deleteAsync(destination, { idempotent: true });
    } catch (error) {
      // Cleanup is best effort and must not replace the original finalization error.
      onCleanupFailure?.({ uri: destination, error });
    }
  };

  try {
    const info = await fileSystem.getInfoAsync(destination);
    if (!info.exists) {
      await cleanupDestination();
      return null;
    }

    return {
      uri: destination,
      sizeBytes: info.size ?? 0,
      modifiedAt: info.modificationTime,
    };
  } catch (error) {
    await cleanupDestination();
    throw error;
  }
}
