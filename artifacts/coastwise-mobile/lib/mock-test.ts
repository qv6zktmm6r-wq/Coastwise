import type { MobileDrive } from './coastwise-context';
import type { DriveEventKind } from './drive-coach';

/**
 * Practice road-test result from measured events only. This is Coastwise's
 * practice bar, not any state's official scoring. Anything the phone did not
 * measure (blinkers, lane position, judgment) is left to the supervising adult.
 */
export type MockTestResult = {
  outcome: 'ready' | 'keep-practicing' | 'not-enough-data';
  critical: Array<{ label: string; count: number }>;
  mistakes: Array<{ label: string; count: number }>;
  totalMistakes: number;
  turnsCompleted: number;
};

/** Measured mistakes allowed before the practice result is "keep practicing". */
export const MOCK_TEST_MAX_MISTAKES = 10;
export const MOCK_TEST_MIN_TURNS = 5;
export const MOCK_TEST_MIN_MINUTES = 10;

/** Actions that fail most road tests on their own. */
const CRITICAL: Partial<Record<DriveEventKind, string>> = {
  'rolling-stop': 'Did not stop completely at a mapped stop sign',
  'camera-rolling-stop': 'Did not stop completely at a stop sign the camera saw',
};

const MISTAKES: Partial<Record<DriveEventKind, string>> = {
  'hard-brake': 'Hard braking',
  'rapid-acceleration': 'Quick acceleration',
  'sharp-turn': 'Turned too sharply or too fast',
  'over-mapped-limit': 'Over a mapped speed limit by 5+ mph',
  'close-following': 'Followed too closely (camera estimate)',
  'eyes-off-road': 'Looked away from the road too long',
  'no-scan-at-stop': 'Did not scan at a stop sign',
};

export function gradeMockTest(drive: MobileDrive): MockTestResult {
  const events = drive.events ?? [];
  const count = (kind: DriveEventKind) => events.filter((event) => event.kind === kind).length;
  const tally = (labels: Partial<Record<DriveEventKind, string>>) =>
    (Object.entries(labels) as Array<[DriveEventKind, string]>)
      .map(([kind, label]) => ({ label, count: count(kind) }))
      .filter((entry) => entry.count > 0);

  const turns = drive.turnScores ?? [];
  const completed = turns.filter((turn) => turn.completed);
  const turnMistakes = [
    { label: 'Did not slow to turning speed', count: completed.filter((turn) => turn.slowed === 'miss').length },
    { label: 'No head check before a turn (driver camera)', count: completed.filter((turn) => turn.headCheck === 'miss').length },
    { label: 'Did not follow a direction', count: turns.length - completed.length },
  ].filter((entry) => entry.count > 0);

  const critical = tally(CRITICAL);
  const mistakes = [...turnMistakes, ...tally(MISTAKES)];
  const totalMistakes = mistakes.reduce((sum, entry) => sum + entry.count, 0);
  const enough = completed.length >= MOCK_TEST_MIN_TURNS && drive.durationMinutes >= MOCK_TEST_MIN_MINUTES;
  const outcome = critical.length > 0 || totalMistakes > MOCK_TEST_MAX_MISTAKES
    ? 'keep-practicing'
    : enough ? 'ready' : 'not-enough-data';
  return { outcome, critical, mistakes, totalMistakes, turnsCompleted: completed.length };
}
