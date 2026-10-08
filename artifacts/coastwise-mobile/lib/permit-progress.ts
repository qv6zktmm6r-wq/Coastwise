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
  id: 'route-turns' | 'stop-signs' | 'braking' | 'acceleration' | 'turns' | 'speed' | 'scanning' | 'head-checks' | 'following' | 'attention';
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

  const complete = countKind(measured, 'stop-sign-complete') + countKind(measured, 'camera-stop-complete');
  const rolling = countKind(measured, 'rolling-stop') + countKind(measured, 'camera-rolling-stop');
  const graded = complete + rolling;
  const scans = countKind(measured, 'scanned-at-stop');
  const missedScans = countKind(measured, 'no-scan-at-stop');
  const headChecks = countKind(measured, 'head-check-before-turn');
  const missedHeadChecks = countKind(measured, 'no-head-check-before-turn');
  const closeFollowing = countKind(measured, 'close-following');
  const eyesOff = countKind(measured, 'eyes-off-road');
  const milesWhere = (included: (drive: MobileDrive) => boolean | undefined) =>
    measured.filter(included).reduce((sum, drive) => sum + drive.distanceMiles, 0);
  const roadCameraMiles = milesWhere((drive) => drive.cameraCoaching);
  const driverCameraMiles = milesWhere((drive) => drive.driverAttention);
  const hardBrakes = countKind(measured, 'hard-brake');
  const quickStarts = countKind(measured, 'rapid-acceleration');
  const fastTurns = countKind(measured, 'sharp-turn');
  const overLimit = countKind(measured, 'over-mapped-limit');
  const routeTurns = measured.flatMap((drive) => drive.turnScores ?? []).filter((turn) => turn.completed);
  const cleanTurns = routeTurns.filter((turn) => turn.slowed !== 'miss' && turn.smooth !== 'miss' && turn.headCheck !== 'miss');
  const turnMisses = {
    slowed: routeTurns.filter((turn) => turn.slowed === 'miss').length,
    smooth: routeTurns.filter((turn) => turn.smooth === 'miss').length,
    headCheck: routeTurns.filter((turn) => turn.headCheck === 'miss').length,
  };
  const worstTurnMiss = (Object.entries(turnMisses) as Array<[keyof typeof turnMisses, number]>).sort((a, b) => b[1] - a[1])[0];
  const turnFocus: Record<keyof typeof turnMisses, string> = {
    slowed: 'Finish slowing to turning speed before the turn starts. Ask for a Left turns or Right turns practice route.',
    smooth: 'Start braking earlier and lighter, and steer through turns without sudden moves.',
    headCheck: 'At the signal call, check the mirror and turn your head toward the side you are turning.',
  };

  return {
    drivesConsidered: measured.length,
    miles,
    trends: [
      {
        id: 'route-turns',
        label: 'Practice-route turns',
        summary: routeTurns.length > 0
          ? `${cleanTurns.length} of ${plural(routeTurns.length, 'route turn')} clean${worstTurnMiss[1] > 0 ? `; most often missed: ${{ slowed: 'slowing down', smooth: 'smooth braking', headCheck: 'head checks' }[worstTurnMiss[0]]}` : ''}.`
          : null,
        concern: routeTurns.length > 0 ? 1 - cleanTurns.length / routeTurns.length : null,
        focus: worstTurnMiss[1] > 0 ? turnFocus[worstTurnMiss[0]] : 'Keep taking turns slowly and checking mirrors and blind spots.',
      },
      {
        id: 'stop-signs',
        label: 'Stop signs (map or camera)',
        summary: graded > 0 ? `${complete} of ${graded} graded stop signs had a complete stop.` : null,
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
        id: 'scanning',
        label: 'Scanning at stop signs (camera)',
        summary: scans + missedScans > 0 ? `Scanned at ${scans} of ${scans + missedScans} stop signs.` : null,
        concern: scans + missedScans > 0 ? missedScans / (scans + missedScans) : null,
        focus: 'At every stop, turn your head left, right, and left again before moving.',
      },
      {
        id: 'head-checks',
        label: 'Head checks before turns (camera)',
        summary: headChecks + missedHeadChecks > 0 ? `Checked before ${headChecks} of ${headChecks + missedHeadChecks} turns.` : null,
        concern: headChecks + missedHeadChecks > 0 ? missedHeadChecks / (headChecks + missedHeadChecks) : null,
        focus: 'Before every turn, check your mirror and turn your head toward the side you are turning.',
      },
      {
        id: 'following',
        label: 'Following distance (camera estimate)',
        summary: roadCameraMiles >= 1 ? `${plural(closeFollowing, 'close-following moment')} in ${roadCameraMiles.toFixed(1)} camera miles.` : null,
        concern: roadCameraMiles >= 1 ? perTenMiles(closeFollowing, roadCameraMiles) / 2 : null,
        focus: 'Pick a fixed point; leave at least three seconds after the car ahead passes it.',
      },
      {
        id: 'attention',
        label: 'Eyes on the road (camera)',
        summary: driverCameraMiles >= 1 ? `${plural(eyesOff, 'long look')} away in ${driverCameraMiles.toFixed(1)} camera miles.` : null,
        concern: driverCameraMiles >= 1 ? perTenMiles(eyesOff, driverCameraMiles) : null,
        focus: 'Keep glances away from the road under two seconds.',
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
