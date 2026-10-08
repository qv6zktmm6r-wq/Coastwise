import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DriveDebrief, NextDrivePlan } from '@workspace/api-client-react';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DriveEventRecord } from './drive-coach';
import { beginDriveState, CURRENT_CALIFORNIA_CONTENT_PACK_VERSION, DEFAULT_JURISDICTION, finishDriveState, getMobileContentPackVersion, hydrateMobileState, isApprovedMobileJurisdiction, saveDriveState, updateDriveState } from './mobile-state';

const STORAGE_KEY = 'coastwise-mobile-state';

export type MobileDrive = {
  id: string;
  date: string;
  durationMinutes: number;
  distanceMiles: number;
  night: boolean;
  skills: string[];
  /** Measured GPS events. Stays on this device; the debrief receives counts only. */
  events?: DriveEventRecord[];
  debrief?: DriveDebrief;
  recordingUri?: string;
  recordingSizeBytes?: number;
};

export type ActiveMobileDrive = MobileDrive & {
  startedAt: string;
  elapsedSeconds: number;
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

type CoastwiseContextValue = MobileState & {
  hydrated: boolean;
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
  saveDrive: (drive: MobileDrive) => void;
  savePlan: (plan: NextDrivePlan) => void;
  acknowledgePrivacy: () => void;
  recordPracticeAnswer: (questionId: string, topic: string, correct: boolean) => void;
};

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

  useEffect(() => {
    if (hydrated) void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const value = useMemo<CoastwiseContextValue>(() => ({
    ...state,
    hydrated,
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
    savePlan: (plan) => setState((current) => ({ ...current, plan })),
    acknowledgePrivacy: () => setState((current) => ({ ...current, acknowledgedPrivacyVersion: '2026-09-18-ios-ai' })),
    recordPracticeAnswer: (questionId, topic, correct) => setState((current) => ({
      ...current,
      practiceProgress: {
        ...(current.practiceProgress ?? {}),
        [`${current.jurisdiction}:${current.contentPackVersion}:${questionId}`]: { correct, topic },
      },
    })),
  }), [hydrated, state]);

  return <CoastwiseContext.Provider value={value}>{children}</CoastwiseContext.Provider>;
}

export function useCoastwise() {
  const value = useContext(CoastwiseContext);
  if (!value) throw new Error('useCoastwise must be used inside CoastwiseProvider');
  return value;
}