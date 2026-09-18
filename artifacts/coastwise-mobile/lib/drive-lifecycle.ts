import type { ActiveMobileDrive, MobileDrive } from './coastwise-context';

export type RecordingMetadata = {
  uri: string;
  sizeBytes: number;
};

type PendingChange = (pending: boolean) => void;

export class DriveLifecycleCoordinator {
  private recordingTask: Promise<void> | null = null;
  private recoveryActionPending = false;
  private ended = false;

  beginDrive() {
    this.ended = false;
    this.recoveryActionPending = false;
  }

  beginRecording(task: Promise<void>) {
    this.recordingTask = task;
    void task.finally(() => {
      if (this.recordingTask === task) this.recordingTask = null;
    });
  }

  pause(
    drive: ActiveMobileDrive,
    elapsedSeconds: number,
    stopNativeSession: () => void,
    persistPausedDrive: (drive: ActiveMobileDrive) => void,
  ) {
    if (this.ended) return null;
    stopNativeSession();
    const paused = { ...drive, elapsedSeconds };
    persistPausedDrive(paused);
    return paused;
  }

  async resume(
    currentDrive: () => ActiveMobileDrive | null,
    resumeNativeSession: (drive: ActiveMobileDrive) => Promise<boolean>,
    onPendingChange: PendingChange,
  ) {
    if (!this.claimRecoveryAction(onPendingChange)) return false;
    try {
      await this.recordingTask;
      if (this.ended) return false;
      const drive = currentDrive();
      if (!drive) return false;
      return await resumeNativeSession(drive);
    } finally {
      this.releaseRecoveryAction(onPendingChange);
    }
  }

  async end(
    currentDrive: () => MobileDrive | null,
    elapsedSeconds: () => number,
    stopNativeSession: () => void,
    finishDrive: (drive: MobileDrive) => void,
    onPendingChange: PendingChange,
  ) {
    if (!this.claimRecoveryAction(onPendingChange)) return false;
    stopNativeSession();
    try {
      await this.recordingTask;
      const drive = currentDrive();
      if (!drive) return false;
      const finished = completeDrive(drive, elapsedSeconds());
      this.ended = true;
      finishDrive(finished);
      return true;
    } finally {
      this.releaseRecoveryAction(onPendingChange);
    }
  }

  discard(
    stopNativeSession: () => void,
    discardDrive: () => void,
    onPendingChange: PendingChange,
  ) {
    if (!this.claimRecoveryAction(onPendingChange)) return false;
    try {
      stopNativeSession();
      this.ended = true;
      discardDrive();
      return true;
    } finally {
      this.releaseRecoveryAction(onPendingChange);
    }
  }

  private claimRecoveryAction(onPendingChange: PendingChange) {
    if (this.recoveryActionPending || this.ended) return false;
    this.recoveryActionPending = true;
    onPendingChange(true);
    return true;
  }

  private releaseRecoveryAction(onPendingChange: PendingChange) {
    this.recoveryActionPending = false;
    onPendingChange(false);
  }
}

export function completeDrive(drive: MobileDrive, elapsedSeconds: number): MobileDrive {
  const {
    startedAt: _startedAt,
    elapsedSeconds: _elapsedSeconds,
    recordingRequested: _recordingRequested,
    ...completed
  } = drive as ActiveMobileDrive;
  return { ...completed, durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)) };
}

export function attachRecording(
  currentDrive: MobileDrive | null,
  recordingDriveId: string,
  metadata: RecordingMetadata,
): MobileDrive | null {
  if (!currentDrive || currentDrive.id !== recordingDriveId) return null;
  return {
    ...currentDrive,
    recordingUri: metadata.uri,
    recordingSizeBytes: metadata.sizeBytes,
  };
}

export function shouldRequestMicrophonePermission(
  driveActive: boolean,
  permission: { granted: boolean } | null | undefined,
) {
  return !driveActive && !permission?.granted;
}