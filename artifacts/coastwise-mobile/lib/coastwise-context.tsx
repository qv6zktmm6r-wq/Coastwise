import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TurnScore } from './turn-scores';
import type { DriveDebrief, NextDrivePlan } from '@workspace/api-client-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { DriveEventRecord } from './drive-coach';
import { beginDriveState, CURRENT_CALIFORNIA_CONTENT_PACK_VERSION, DEFAULT_JURISDICTION, addDriveState, deleteDriveState, finishDriveState, getMobileContentPackVersion, hydrateMobileState, isApprovedMobileJurisdiction, saveDriveState, updateDriveState } from './mobile-state';

const STORAGE_KEY = 'coastwise-mobile-state';

export type MobileDrive = {
  id: string;
  date: string;
  durationMinutes: number;
  distanceMiles: number;
  night: boolean;
  /** Minutes driven between local sunset and sunrise. Missing on drives saved before it was measured. */
  nightMinutes?: number;
  skills: string[];
  /** Measured GPS events. Stays on this device; the debrief receives counts only. */
  events?: DriveEventRecord[];
  /** True when on-device camera coaching ran for this drive. */
  cameraCoaching?: boolean;
  /** True when the opt-in driver-facing attention camera ran for this drive. */
  driverAttention?: boolean;
  /** 'manual' when a supervising adult logged a drive made without the app; nothing was measured. */
  source?: 'app' | 'manual';
  /** True when the drive was a mock road test: directions only, graded at the end. */
  mockTest?: boolean;
  /** Per-turn review for drives that followed a planned route. Stays on this device. */
  turnScores?: TurnScore[];
  debrief?: DriveDebrief;
  recordingUri?: string;
  recordingSizeBytes?: number;
};

export type ActiveMobileDrive = MobileDrive & {
  startedAt: string;
  elapsedSeconds: number;
  /** Seconds driven after dark so far, from local sunrise and sunset. */
  nightSeconds?: number;
  recordingRequested?: boolean;
};

export type MobileJurisdiction = 'US-CA' | 'US-TX' | 'US-FL' | 'US-NY' | 'US-OH' | 'US-IL';

export type MobileState = {
  drives: MobileDrive[];
  jurisdiction: MobileJurisdiction;
  contentPackVersion: string;
  plan?: NextDrivePlan;
  acknowledgedPrivacyVersion?: string;
  activeDrive?: ActiveMobileDrive;
  role?: 'unselected' | 'teen' | 'parent';
  hasCompletedOnboarding?: boolean;
  recordingRetentionDays?: number | 'forever';
  parentGoal?: { targetMinutes: number; skill: string };
  practiceProgress?: Record<string, { correct: boolean; topic: string }>;
};

type CoastwiseActions = {
  setJurisdiction: (jurisdiction: MobileJurisdiction) => void;
  setRole: (role: 'teen' | 'parent') => void;
  completeOnboarding: () => void;
  setRecordingRetention: (days: number | 'forever') => void;
  setParentGoal: (goal: { targetMinutes: number; skill: string }) => void;
  beginActiveDrive: (drive: ActiveMobileDrive) => void;
  updateActiveDrive: (drive: ActiveMobileDrive) => void;
  finishActiveDrive: (drive: MobileDrive) => void;
  discardActiveDrive: () => void;
  forgetRecording: (uri: string) => void;
  forgetAllRecordings: () => void;
  /** Updates a saved drive; ignored if it was deleted. */
  saveDrive: (drive: MobileDrive) => void;
  /** Adds a new drive to the log, such as one logged by hand. */
  addDrive: (drive: MobileDrive) => void;
  deleteDrive: (driveId: string) => void;
  savePlan: (plan: NextDrivePlan) => void;
  acknowledgePrivacy: () => void;
  recordPracticeAnswer: (questionId: string, topic: string, correct: boolean) => void;
};

type CoastwiseContextValue = MobileState & CoastwiseActions & { hydrated: boolean };

const PERSIST_INTERVAL_MS = 1_500;

const CoastwiseContext = createContext<CoastwiseContextValue | null>(null);

export function CoastwiseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MobileState>({
    drives: [],
    jurisdiction: DEFAULT_JURISDICTION,
    contentPackVersion: CURRENT_CALIFORNIA_CONTENT_PACK_VERSION,
    practiceProgress: {},
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved) setState(hydrateMobileState(JSON.parse(saved)));
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  const latestState = useRef(state);
  latestState.current = state;
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistNow = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = null;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(latestState.current)).catch(() => undefined);
  }, []);

  // A drive changes state about once a second; write at most every PERSIST_INTERVAL_MS, and flush before the app is backgrounded.
  useEffect(() => {
    if (!hydrated || persistTimer.current) return;
    persistTimer.current = setTimeout(persistNow, PERSIST_INTERVAL_MS);
  }, [hydrated, state, persistNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && persistTimer.current) persistNow();
    });
    return () => {
      subscription.remove();
      if (persistTimer.current) persistNow();
    };
  }, [persistNow]);

  const actions = useMemo<CoastwiseActions>(() => ({
    setJurisdiction: (jurisdiction) => setState((current) => isApprovedMobileJurisdiction(jurisdiction) ? ({
      ...current,
      jurisdiction,
      // A jurisdiction change must never carry a pack from another state.
      contentPackVersion: getMobileContentPackVersion(jurisdiction),
      plan: undefined,
    }) : current),
    setRole: (role) => setState((current) => ({ ...current, role })),
    completeOnboarding: () => setState((current) => ({ ...current, hasCompletedOnboarding: true })),
    setRecordingRetention: (days) => setState((current) => ({ ...current, recordingRetentionDays: days })),
    setParentGoal: (goal) => setState((current) => ({ ...current, parentGoal: goal })),
    beginActiveDrive: (drive) => setState((current) => beginDriveState(current, drive)),
    updateActiveDrive: (drive) => setState((current) => updateDriveState(current, drive)),
    finishActiveDrive: (drive) => setState((current) => finishDriveState(current, drive)),
    discardActiveDrive: () => setState((current) => ({ ...current, activeDrive: undefined })),
    forgetRecording: (uri) => setState((current) => ({
      ...current,
      activeDrive: current.activeDrive?.recordingUri === uri
        ? { ...current.activeDrive, recordingUri: undefined, recordingSizeBytes: undefined }
        : current.activeDrive,
      drives: current.drives.map((drive) => drive.recordingUri === uri
        ? { ...drive, recordingUri: undefined, recordingSizeBytes: undefined }
        : drive),
    })),
    forgetAllRecordings: () => setState((current) => ({
      ...current,
      activeDrive: current.activeDrive
        ? { ...current.activeDrive, recordingUri: undefined, recordingSizeBytes: undefined }
        : undefined,
      drives: current.drives.map((drive) => ({
        ...drive,
        recordingUri: undefined,
        recordingSizeBytes: undefined,
      })),
    })),
    saveDrive: (drive) => setState((current) => saveDriveState(current, drive)),
    addDrive: (drive) => setState((current) => addDriveState(current, drive)),
    deleteDrive: (driveId) => setState((current) => deleteDriveState(current, driveId)),
    savePlan: (plan) => setState((current) => ({ ...current, plan })),
    acknowledgePrivacy: () => setState((current) => ({ ...current, acknowledgedPrivacyVersion: '2026-09-18-ios-ai' })),
    recordPracticeAnswer: (questionId, topic, correct) => setState((current) => ({
      ...current,
      practiceProgress: {
        ...(current.practiceProgress ?? {}),
        [`${current.jurisdiction}:${current.contentPackVersion}:${questionId}`]: { correct, topic },
      },
    })),
  }), []);

  const value = useMemo<CoastwiseContextValue>(() => ({ ...state, hydrated, ...actions }), [state, hydrated, actions]);

  return <CoastwiseContext.Provider value={value}>{children}</CoastwiseContext.Provider>;
}

export function useCoastwise() {
  const value = useContext(CoastwiseContext);
  if (!value) throw new Error('useCoastwise must be used inside CoastwiseProvider');
  return value;
}