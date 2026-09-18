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
let destinationReservation: Promise<void> = Promise.resolve();

function createDestinationName() {
  const timestamp = Date.now();
  destinationSequence = timestamp === lastDestinationTimestamp ? destinationSequence + 1 : 0;
  lastDestinationTimestamp = timestamp;
  const uniqueSuffix = Math.random().toString(36).slice(2, 11);
  return `coastwise-drive-${timestamp}-${destinationSequence}-${uniqueSuffix}.mp4`;
}

async function withDestinationReservation<T>(task: () => Promise<T>) {
  const previousReservation = destinationReservation;
  let releaseReservation!: () => void;
  destinationReservation = new Promise<void>((resolve) => {
    releaseReservation = resolve;
  });
  await previousReservation;
  try {
    return await task();
  } finally {
    releaseReservation();
  }
}

async function chooseDestination(
  fileSystem: RecordingFileSystem,
  destinationName?: string,
) {
  if (destinationName) return `${fileSystem.documentDirectory}${destinationName}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const destination = `${fileSystem.documentDirectory}${createDestinationName()}`;
    const info = await fileSystem.getInfoAsync(destination);
    if (!info.exists) return destination;
  }

  throw new Error('Could not reserve a unique local recording destination.');
}

export async function finalizeRecording(
  result: CameraRecordingResult,
  fileSystem: RecordingFileSystem,
  destinationName?: string,
  onCleanupFailure?: (failure: RecordingCleanupFailure) => void,
): Promise<FinalizedRecording | null> {
  if (!result?.uri || !fileSystem.documentDirectory) return null;

  const destination = await withDestinationReservation(async () => {
    const reservedDestination = await chooseDestination(fileSystem, destinationName);
    await fileSystem.copyAsync({ from: result.uri!, to: reservedDestination });
    return reservedDestination;
  });

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
