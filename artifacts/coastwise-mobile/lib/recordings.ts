import * as FileSystem from 'expo-file-system/legacy';
import {
  finalizeRecording as finalizeRecordingFile,
  type CameraRecordingResult,
  type FinalizedRecording,
  type RecordingFileSystem,
} from './recording-finalization';

export type { CameraRecordingResult, FinalizedRecording };

export type LocalRecording = {
  uri: string;
  name: string;
  sizeBytes: number;
  modifiedAt?: number;
};

const RECORDING_PREFIXES = ['coastwise-drive-', 'drive-'];

export async function finalizeRecording(result: CameraRecordingResult): Promise<FinalizedRecording | null> {
  const fileSystem: RecordingFileSystem = {
    documentDirectory: FileSystem.documentDirectory,
    copyAsync: (options) => FileSystem.copyAsync(options),
    deleteAsync: (uri, options) => FileSystem.deleteAsync(uri, options),
    getInfoAsync: async (uri) => {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) return { exists: false };
      return {
        size: info.size,
        modificationTime: info.modificationTime,
        exists: true,
      };
    },
  };
  return finalizeRecordingFile(result, fileSystem);
}

export async function listLocalRecordings(): Promise<LocalRecording[]> {
  if (!FileSystem.documentDirectory) return [];
  const names = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
  const recordings = await Promise.all(names
    .filter((name) => RECORDING_PREFIXES.some((prefix) => name.startsWith(prefix)) && name.endsWith('.mp4'))
    .map(async (name): Promise<LocalRecording | null> => {
      const uri = `${FileSystem.documentDirectory}${name}`;
      const info = await FileSystem.getInfoAsync(uri);
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

export async function cleanupLocalRecordings(retentionDays: number | 'forever'): Promise<string[]> {
  if (retentionDays === 'forever') return [];
  const recordings = await listLocalRecordings();
  const now = Date.now() / 1000;
  const cutoff = now - retentionDays * 24 * 60 * 60;
  
  const toDelete = recordings.filter(r => r.modifiedAt !== undefined && r.modifiedAt < cutoff);
  await Promise.all(toDelete.map(r => deleteLocalRecording(r.uri)));
  
  return toDelete.map(r => r.uri);
}

export const STORAGE_WARNING_BYTES = 500 * 1024 * 1024;

export function formatStorageSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}