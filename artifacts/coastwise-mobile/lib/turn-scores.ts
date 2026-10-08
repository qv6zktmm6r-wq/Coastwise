import type { ManeuverKind } from './route-planner.ts';

/**
 * Per-turn review for route drives. Each check uses only what the phone
 * measured; anything it could not measure is reported as not measured.
 * Blinker use is never measured.
 */
export type TurnCheck = 'pass' | 'miss' | 'not-measured' | 'not-applicable';

export type TurnScore = {
  instruction: string;
  kind: ManeuverKind;
  /** False when the driver skipped this turn or left the route before it. */
  completed: boolean;
  slowed: TurnCheck;
  smooth: TurnCheck;
  headCheck: TurnCheck;
  slowestMph: number | null;
};

export type TurnObservation = {
  instruction: string;
  kind: ManeuverKind;
  completed: boolean;
  preparedAt: number | null;
  signaledAt: number | null;
  reachedAt: number;
  speeds: Array<{ at: number; mph: number }>;
  roughEvents: Array<{ at: number; kind: string }>;
  /** Null when the driver camera was off. */
  headCheck: { reliable: boolean; headTurns: number } | null;
};

/** Wait this long after reaching a turn so braking and cornering through it are counted. */
export const TURN_SETTLE_MS = 8_000;
/** Without an earlier call, look this far back for the approach. */
const DEFAULT_APPROACH_MS = 15_000;
const AFTER_TURN_SPEED_MS = 4_000;
/** A typical 90° city turn is taken well under 20 mph; faster suggests the driver did not slow down. */
export const TURNING_SPEED_MPH = 20;
const SLOW_FOR: ManeuverKind[] = ['left', 'right', 'uturn', 'roundabout'];
const ROUGH_KINDS = new Set(['hard-brake', 'sharp-turn']);

export function approachStart(observation: Pick<TurnObservation, 'preparedAt' | 'signaledAt' | 'reachedAt'>) {
  return observation.preparedAt ?? observation.signaledAt ?? observation.reachedAt - DEFAULT_APPROACH_MS;
}

export function scoreTurn(observation: TurnObservation): TurnScore {
  const base = { instruction: observation.instruction, kind: observation.kind, completed: observation.completed };
  if (!observation.completed) {
    return { ...base, slowed: 'not-measured', smooth: 'not-measured', headCheck: 'not-measured', slowestMph: null };
  }
  const start = approachStart(observation);
  const approachSpeeds = observation.speeds
    .filter((sample) => sample.at >= start && sample.at <= observation.reachedAt + AFTER_TURN_SPEED_MS)
    .map((sample) => sample.mph);
  const slowestMph = approachSpeeds.length > 0 ? Math.min(...approachSpeeds) : null;
  const slowed: TurnCheck = !SLOW_FOR.includes(observation.kind)
    ? 'not-applicable'
    : slowestMph === null
      ? 'not-measured'
      : slowestMph <= TURNING_SPEED_MPH ? 'pass' : 'miss';
  const rough = observation.roughEvents.some((event) =>
    ROUGH_KINDS.has(event.kind) && event.at >= start && event.at <= observation.reachedAt + TURN_SETTLE_MS);
  const headCheck: TurnCheck = !observation.headCheck || !observation.headCheck.reliable
    ? 'not-measured'
    : observation.headCheck.headTurns > 0 ? 'pass' : 'miss';
  return { ...base, slowed, smooth: rough ? 'miss' : 'pass', headCheck, slowestMph: slowestMph === null ? null : Math.round(slowestMph) };
}

export function summarizeTurns(scores: TurnScore[]) {
  const completed = scores.filter((score) => score.completed);
  const clean = completed.filter((score) => score.slowed !== 'miss' && score.smooth !== 'miss' && score.headCheck !== 'miss');
  return { total: scores.length, completed: completed.length, clean: clean.length, missed: scores.length - completed.length };
}
