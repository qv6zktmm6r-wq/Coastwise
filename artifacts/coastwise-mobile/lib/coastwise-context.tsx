import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DriveDebrief, NextDrivePlan } from '@workspace/api-client-react';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'coastwise-mobile-state';

export type MobileDrive = {
  id: string;
  date: string;
  durationMinutes: number;
  distanceMiles: number;
  night: boolean;
  skills: string[];
  debrief?: DriveDebrief;
  recordingUri?: string;
  recordingSizeBytes?: number;
};

export type ActiveMobileDrive = MobileDrive & {
  startedAt: string;
  elapsedSeconds: number;
};

type MobileState = {
  drives: MobileDrive[];
  plan?: NextDrivePlan;
  acknowledgedPrivacyVersion?: string;
  activeDrive?: ActiveMobileDrive;
};

type CoastwiseContextValue = MobileState & {
  hydrated: boolean;
  beginActiveDrive: (drive: ActiveMobileDrive) => void;
  updateActiveDrive: (drive: ActiveMobileDrive) => void;
  finishActiveDrive: (drive: MobileDrive) => void;
  saveDrive: (drive: MobileDrive) => void;
  savePlan: (plan: NextDrivePlan) => void;
  acknowledgePrivacy: () => void;
};

const CoastwiseContext = createContext<CoastwiseContextValue | null>(null);

export function CoastwiseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MobileState>({ drives: [] });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved) setState(JSON.parse(saved) as MobileState);
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
    beginActiveDrive: (drive) => setState((current) => ({ ...current, activeDrive: drive })),
    updateActiveDrive: (drive) => setState((current) => ({ ...current, activeDrive: drive })),
    finishActiveDrive: (drive) => setState((current) => ({
      ...current,
      activeDrive: undefined,
      drives: current.drives.some((item) => item.id === drive.id)
        ? current.drives.map((item) => item.id === drive.id ? drive : item)
        : [drive, ...current.drives].slice(0, 50),
    })),
    saveDrive: (drive) => setState((current) => ({
      ...current,
      drives: current.drives.some((item) => item.id === drive.id)
        ? current.drives.map((item) => item.id === drive.id ? drive : item)
        : [drive, ...current.drives].slice(0, 50),
    })),
    savePlan: (plan) => setState((current) => ({ ...current, plan })),
    acknowledgePrivacy: () => setState((current) => ({ ...current, acknowledgedPrivacyVersion: '2026-09-18-ios-ai' })),
  }), [hydrated, state]);

  return <CoastwiseContext.Provider value={value}>{children}</CoastwiseContext.Provider>;
}

export function useCoastwise() {
  const value = useContext(CoastwiseContext);
  if (!value) throw new Error('useCoastwise must be used inside CoastwiseProvider');
  return value;
}