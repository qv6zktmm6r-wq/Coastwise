export type CameraRecordingResult = {
  uri?: string | null;
} | null | undefined;

export type RecordingFileSystem = {
  documentDirectory?: string | null;
  copyAsync: (options: { from: string; to: string }) => Promise<void>;
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

export async function finalizeRecording(
  result: CameraRecordingResult,
  fileSystem: RecordingFileSystem,
  destinationName = `coastwise-drive-${Date.now()}.mp4`,
): Promise<FinalizedRecording | null> {
  if (!result?.uri || !fileSystem.documentDirectory) return null;

  const destination = `${fileSystem.documentDirectory}${destinationName}`;
  await fileSystem.copyAsync({ from: result.uri, to: destination });
  const info = await fileSystem.getInfoAsync(destination);
  if (!info.exists) return null;

  return {
    uri: destination,
    sizeBytes: info.size ?? 0,
    modifiedAt: info.modificationTime,
  };
}