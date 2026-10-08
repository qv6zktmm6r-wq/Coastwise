import type { MobileDrive, MobileJurisdiction } from './coastwise-context';
import type { DriveEventKind } from './drive-coach';

/**
 * Supervised practice requirements. Must match `supervisedHours` / `nightHours` in
 * artifacts/california-driver-coach/src/lib/jurisdiction.ts and the approved
 * docs/content-packs/*-source-matrix.md records.
 */
export const PRACTICE_REQUIREMENTS: Record<MobileJurisdiction, { totalHours: number; nightHours: number; nightLabel: string }> = {
  'US-CA': { totalHours: 50, nightHours: 10, nightLabel: 'at night' },
  'US-TX': { totalHours: 30, nightHours: 10, nightLabel: 'at night' },
  'US-FL': { totalHours: 50, nightHours: 10, nightLabel: 'at night' },
  'US-NY': { totalHours: 50, nightHours: 15, nightLabel: 'after sunset' },
  'US-OH': { totalHours: 50, nightHours: 10, nightLabel: 'at night' },
  'US-IL': { totalHours: 50, nightHours: 10, nightLabel: 'at night' },
};

/** Drives saved before night minutes were measured count entirely as day or night. */
export function driveNightMinutes(drive: MobileDrive) {
  if (drive.nightMinutes !== undefined) return Math.min(drive.nightMinutes, drive.durationMinutes);
  return drive.night ? drive.durationMinutes : 0;
}

export function permitProgress(drives: MobileDrive[], jurisdiction: MobileJurisdiction) {
  const requirement = PRACTICE_REQUIREMENTS[jurisdiction];
  const totalMinutes = drives.reduce((sum, drive) => sum + drive.durationMinutes, 0);
  const nightMinutes = drives.reduce((sum, drive) => sum + driveNightMinutes(drive), 0);
  const totalMiles = drives.reduce((sum, drive) => sum + drive.distanceMiles, 0);
  return {
    ...requirement,
    totalMinutes,
    nightMinutes,
    totalMiles,
    totalComplete: totalMinutes >= requirement.totalHours * 60,
    nightComplete: nightMinutes >= requirement.nightHours * 60,
  };
}

export type SkillTrend = {
  id: 'stop-signs' | 'braking' | 'acceleration' | 'turns' | 'speed';
  label: string;
  /** Plain-language result from measured events only. Null when there is no evidence yet. */
  summary: string | null;
  /** Higher means more practice needed. Null when there is no evidence yet. */
  concern: number | null;
  focus: string;
};

const RECENT_DRIVES = 5;

function countKind(drives: MobileDrive[], kind: DriveEventKind) {
  return drives.reduce((sum, drive) => sum + (drive.events ?? []).filter((event) => event.kind === kind).length, 0);
}

function perTenMiles(count: number, miles: number) {
  return miles > 0 ? count / miles * 10 : 0;
}

/**
 * Summarizes the most recent measured drives. Only drives that recorded events
 * (made with the measuring coach) count, so older drives never read as perfect.
 */
export function skillTrends(drives: MobileDrive[]): { drivesConsidered: number; miles: number; trends: SkillTrend[] } {
  const measured = [...drives]
    .filter((drive) => drive.events !== undefined)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, RECENT_DRIVES);
  const miles = measured.reduce((sum, drive) => sum + drive.distanceMiles, 0);
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const hasMiles = miles >= 1;

  const complete = countKind(measured, 'stop-sign-complete');
  const rolling = countKind(measured, 'rolling-stop');
  const graded = complete + rolling;
  const hardBrakes = countKind(measured, 'hard-brake');
  const quickStarts = countKind(measured, 'rapid-acceleration');
  const fastTurns = countKind(measured, 'sharp-turn');
  const overLimit = countKind(measured, 'over-mapped-limit');

  return {
    drivesConsidered: measured.length,
    miles,
    trends: [
      {
        id: 'stop-signs',
        label: 'Stop signs (mapped)',
        summary: graded > 0 ? `${complete} of ${graded} mapped stop signs had a complete stop.` : null,
        concern: graded > 0 ? rolling / graded : null,
        focus: 'Stop completely behind the line, count a full second, then scan left, right, and left.',
      },
      {
        id: 'braking',
        label: 'Smooth braking',
        summary: hasMiles ? `${plural(hardBrakes, 'hard brake')} in ${miles.toFixed(1)} miles.` : null,
        concern: hasMiles ? perTenMiles(hardBrakes, miles) / 2 : null,
        focus: 'Look farther ahead and start braking earlier with lighter pressure.',
      },
      {
        id: 'acceleration',
        label: 'Smooth starts',
        summary: hasMiles ? `${plural(quickStarts, 'quick start')} in ${miles.toFixed(1)} miles.` : null,
        concern: hasMiles ? perTenMiles(quickStarts, miles) / 2 : null,
        focus: 'Roll onto the gas gradually from a stop.',
      },
      {
        id: 'turns',
        label: 'Turn speed',
        summary: hasMiles ? `${plural(fastTurns, 'fast turn')} in ${miles.toFixed(1)} miles.` : null,
        concern: hasMiles ? perTenMiles(fastTurns, miles) / 2 : null,
        focus: 'Finish slowing before the turn starts, then accelerate gently out of it.',
      },
      {
        id: 'speed',
        label: 'Speed vs. mapped limits',
        summary: hasMiles ? `${plural(overLimit, 'time')} 5+ mph over a mapped limit in ${miles.toFixed(1)} miles.` : null,
        concern: hasMiles ? perTenMiles(overLimit, miles) / 2 : null,
        focus: 'Check the speedometer after every speed limit sign and when the road changes.',
      },
    ],
  };
}

/** The skill with the most measured concern, or null when nothing measured needs work. */
export function nextFocus(trends: SkillTrend[]) {
  const ranked = trends
    .filter((trend) => trend.concern !== null && trend.concern > 0)
    .sort((a, b) => (b.concern ?? 0) - (a.concern ?? 0));
  return ranked[0] ?? null;
}
