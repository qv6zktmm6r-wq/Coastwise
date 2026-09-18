import * as FileSystem from 'expo-file-system/legacy';

export type LocalRecording = {
  uri: string;
  name: string;
  sizeBytes: number;
  modifiedAt?: number;
};

const RECORDING_PREFIXES = ['coastwise-drive-', 'drive-'];

export async function listLocalRecordings(): Promise<LocalRecording[]> {
  if (!FileSystem.documentDirectory) return [];
  const names = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
  const recordings = await Promise.all(names
    .filter((name) => RECORDING_PREFIXES.some((prefix) => name.startsWith(prefix)) && name.endsWith('.mp4'))
    .map(async (name) => {
      const uri = `${FileSystem.documentDirectory}${name}`;
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      if (!info.exists) return null;
      return {
        uri,
        name,
        sizeBytes: info.size ?? 0,
        modifiedAt: info.modificationTime,
      };
    }));
  return recordings
    .filter((recording): recording is LocalRecording => recording !== null)
    .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
}

export async function deleteLocalRecording(uri: string) {
  await FileSystem.deleteAsync(uri, { idempotent: true });
}

export async function deleteAllLocalRecordings() {
  const recordings = await listLocalRecordings();
  await Promise.all(recordings.map((recording) => deleteLocalRecording(recording.uri)));
}

export function formatStorageSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}