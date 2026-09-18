import type { LucideIcon } from 'lucide-react';
import type { DriveDebrief, NextDrivePlan } from '@workspace/api-client-react';
import type { CoachEvent } from './drive-review';
import type { PlannedRoute } from './route-coach';

import type { PracticeAnswer } from '../components/practice-hub';

export type Topic = { topic: string; mastery: number; questions: number };
export type PracticeQuestion = { prompt: string; options: string[]; answer: number; explanation: string; topic: string };
export type Scenario = { situation: string; choices: string[]; bestChoice: number; coaching: string };
export type DriveMission = { title: string; detail: string; category: string; minutes: number; completed: boolean };
export type DriveSession = { id: string; date: string; minutes: number; night: boolean; notes: string; distanceMiles?: number; skills?: string[]; routeTitle?: string; review?: { id: string; durationSeconds: number; eventCount: number; events: CoachEvent[]; route: PlannedRoute; videoType: string; aiDebrief?: DriveDebrief } };
export type ParentPrompt = { title: string; copy: string; done: boolean };
export type Appearance = 'system' | 'light' | 'dark';

export type AppState = {
  profile: { name: string; permitDate: string; targetTestDate: string };
  topics: Topic[];
  answers: Record<number, boolean>;
  practiceProgress: Record<string, PracticeAnswer>;
  scenarios: Scenario[];
  scenarioAnswers: Record<number, number>;
  missions: DriveMission[];
  sessions: DriveSession[];
  prompts: ParentPrompt[];
  nextDrivePlan?: NextDrivePlan;
  settings: { parentMode: boolean; reminders: boolean; sounds: boolean; appearance: Appearance };
};

export const initialState: AppState = {
  profile: { name: '', permitDate: '', targetTestDate: '' },
  topics: [
    { topic: 'Right-of-way', mastery: 0, questions: 0 },
    { topic: 'Signs & signals', mastery: 0, questions: 0 },
    { topic: 'Safe speed', mastery: 0, questions: 0 },
    { topic: 'Sharing the road', mastery: 0, questions: 0 },
  ],
  answers: {},
  practiceProgress: {},
  scenarios: [
    { situation: 'You are turning left at a green light. A pedestrian has stepped into the crosswalk, and the car behind you is close.', choices: ['Turn before the pedestrian reaches your lane', 'Stop behind the limit line and let the pedestrian cross', 'Honk so the pedestrian knows you are waiting'], bestChoice: 1, coaching: 'A patient pause is the safest move. People in a crosswalk have the right-of-way, even when traffic is waiting behind you.' },
    { situation: 'Rain starts on a familiar road. The posted limit is 45 mph and your visibility is getting worse.', choices: ['Keep 45 mph because it is the legal limit', 'Slow down enough to see and stop comfortably', 'Turn on hazard lights and continue at 45 mph'], bestChoice: 1, coaching: 'The speed limit is not a target in every condition. Choose a speed that lets you see, react, and keep a generous following distance.' },
    { situation: 'You are approaching a four-way stop at the same time as another driver on your right.', choices: ['Go first because you are already rolling', 'Wave them through, then go when clear', 'Yield to the driver on your right'], bestChoice: 2, coaching: 'At an all-way stop, the driver who arrived first goes first. If arrival is at the same time, yield to the driver on your right.' },
  ],
  scenarioAnswers: {},
  missions: [
    { title: 'Smooth starts & stops', detail: 'Practice gentle acceleration and braking on a quiet street.', category: 'Control', minutes: 25, completed: false },
    { title: 'Lane-change rhythm', detail: 'Mirror, signal, shoulder check, then move with space.', category: 'Awareness', minutes: 30, completed: false },
    { title: 'Neighborhood navigation', detail: 'Plan a three-turn loop and narrate what you see ahead.', category: 'Navigation', minutes: 35, completed: false },
    { title: 'Busy intersection scan', detail: 'Approach, identify hazards, and make two calm left turns.', category: 'Judgment', minutes: 30, completed: false },
    { title: 'Night-drive basics', detail: 'With an adult, practice headlights, glare, and slower speeds.', category: 'Night', minutes: 25, completed: false },
  ],
  sessions: [],
  prompts: [
    { title: 'Ask for a calm replay', copy: 'After a tricky moment, ask: “What did you notice first?” before offering your answer.', done: false },
    { title: 'Name the win', copy: 'Call out one specific choice that felt safe or smooth today.', done: false },
    { title: 'Set the next tiny goal', copy: 'Pick one skill for the next drive, not a whole list.', done: false },
    { title: 'Keep the cabin quiet', copy: 'Save corrections for a safe stop. A calm driver learns faster.', done: false },
  ],
  settings: { parentMode: false, reminders: true, sounds: false, appearance: 'system' },
};

export const storageKey = 'california-driver-coach';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAppearance(value: unknown): value is Appearance {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function normalizeDriveSessions(value: unknown): DriveSession[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((session, index) => ({
    ...session,
    id: typeof session.id === 'string' && session.id
      ? session.id
      : isRecord(session.review) && typeof session.review.id === 'string'
        ? session.review.id
        : `legacy-drive-${index}-${String(session.date ?? 'unknown')}-${String(session.minutes ?? 0)}`,
  })) as DriveSession[];
}

export function parseStoredState(saved: string | null): AppState {
  if (!saved) return initialState;
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!isRecord(parsed)) return initialState;
    const storedProfile = isRecord(parsed.profile) ? parsed.profile : {};
    const storedSettings = isRecord(parsed.settings) ? parsed.settings : {};
    const storedSessions = Array.isArray(parsed.sessions) ? normalizeDriveSessions(parsed.sessions) : initialState.sessions;
    return {
      ...initialState,
      ...parsed,
      profile: { ...initialState.profile, ...storedProfile },
      settings: {
        ...initialState.settings,
        ...storedSettings,
        appearance: isAppearance(storedSettings.appearance) ? storedSettings.appearance : initialState.settings.appearance,
      },
      sessions: storedSessions,
    };
  } catch {
    return initialState;
  }
}

export function createDriveSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `drive-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getStoredState(): AppState {
  if (typeof window === 'undefined') return initialState;
  try {
    return parseStoredState(window.localStorage.getItem(storageKey));
  } catch {
    return initialState;
  }
}
