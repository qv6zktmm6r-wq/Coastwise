import type { AttentionEventKind } from './driver-attention';
import type { DriveSignalKind } from './drive-signals';
import type { MapEventKind } from './maneuvers';
import type { VisionEventKind } from './road-vision';

export type StopScanKind = 'scanned-at-stop' | 'no-scan-at-stop';
export type DriveEventKind = DriveSignalKind | MapEventKind | VisionEventKind | AttentionEventKind | StopScanKind;

export type DriveEventRecord = {
  kind: DriveEventKind;
  secondsIntoDrive: number;
  speedMph: number;
  magnitude: number;
  limitMph?: number;
};

export type DebriefEvent = {
  kind: 'start' | 'prompt' | 'maneuver' | 'safety';
  title: string;
  detail: string;
};

export type CoachVoiceState = {
  lastSpokenAt: number | null;
  lastPraiseAt: number | null;
};

export type CoachableEvent = {
  kind: DriveEventKind;
  at: number;
  speedMph: number;
  magnitude: number;
  limitMph?: number;
};

export const initialCoachVoiceState: CoachVoiceState = { lastSpokenAt: null, lastPraiseAt: null };
export const MAX_STORED_EVENTS = 300;
/** One cue at a time. Never stack instructions while the student is handling the car. */
export const MIN_SECONDS_BETWEEN_CUES = 6;
/** Praise is useful when it is rare. */
export const MIN_SECONDS_BETWEEN_PRAISE = 180;

const MPH_PER_METER_PER_SECOND_SQUARED = 2.236936;

const cues: Record<DriveEventKind, {
  title: string;
  /** Null: recorded for review only. Camera-based events stay silent until real-drive testing proves them. */
  spoken: ((event: Pick<CoachableEvent, 'speedMph' | 'limitMph'>) => string) | null;
  praise: boolean;
  debriefKind: DebriefEvent['kind'];
}> = {
  'hard-brake': {
    title: 'Hard braking',
    spoken: () => 'That was a hard stop. Look farther ahead and ease off sooner.',
    praise: false,
    debriefKind: 'safety',
  },
  'rapid-acceleration': {
    title: 'Quick acceleration',
    spoken: () => 'Ease into the gas a little smoother.',
    praise: false,
    debriefKind: 'safety',
  },
  'sharp-turn': {
    title: 'Fast turn',
    spoken: () => 'That turn was quick. Slow down before the turn, not during it.',
    praise: false,
    debriefKind: 'safety',
  },
  'full-stop': {
    title: 'Full stop',
    spoken: () => 'Nice full stop.',
    praise: true,
    debriefKind: 'maneuver',
  },
  'stop-sign-complete': {
    title: 'Complete stop at a mapped stop sign',
    spoken: () => 'Good, a complete stop at the stop sign.',
    praise: true,
    debriefKind: 'maneuver',
  },
  'rolling-stop': {
    title: 'Rolling stop at a mapped stop sign',
    spoken: () => 'The map shows a stop sign there, and the car kept rolling. Come to a complete stop next time.',
    praise: false,
    debriefKind: 'maneuver',
  },
  'over-mapped-limit': {
    title: 'Over the mapped speed limit',
    spoken: ({ speedMph, limitMph }) => `The map shows a ${limitMph} limit here. You are at about ${Math.round(speedMph)}. Ease off.`,
    praise: false,
    debriefKind: 'safety',
  },
  'camera-stop-complete': { title: 'Complete stop at a stop sign (camera)', spoken: null, praise: false, debriefKind: 'maneuver' },
  'camera-rolling-stop': { title: 'Rolling stop at a stop sign (camera)', spoken: null, praise: false, debriefKind: 'maneuver' },
  'close-following': { title: 'Close following (camera estimate)', spoken: null, praise: false, debriefKind: 'safety' },
  'head-check-before-turn': { title: 'Head check before a turn', spoken: null, praise: false, debriefKind: 'maneuver' },
  'no-head-check-before-turn': { title: 'No head check before a turn', spoken: null, praise: false, debriefKind: 'maneuver' },
  'eyes-off-road': { title: 'Looked away while moving', spoken: null, praise: false, debriefKind: 'safety' },
  'scanned-at-stop': { title: 'Scanned at a stop sign', spoken: null, praise: false, debriefKind: 'maneuver' },
  'no-scan-at-stop': { title: 'No scan at a stop sign', spoken: null, praise: false, debriefKind: 'maneuver' },
};

const CAMERA_KINDS = new Set<DriveEventKind>([
  'camera-stop-complete', 'camera-rolling-stop', 'close-following',
  'head-check-before-turn', 'no-head-check-before-turn', 'eyes-off-road', 'scanned-at-stop', 'no-scan-at-stop',
]);
const MAP_KINDS = new Set<DriveEventKind>(['stop-sign-complete', 'rolling-stop', 'over-mapped-limit']);

export function coachTitle(kind: DriveEventKind) {
  return cues[kind].title;
}

/** States only what GPS measured or the map shows, so the debrief never implies the phone saw the road. */
export function describeEvent(event: Pick<DriveEventRecord, 'kind' | 'speedMph' | 'magnitude' | 'limitMph'>) {
  const mph = Math.round(event.speedMph);
  const rate = Math.round(event.magnitude * MPH_PER_METER_PER_SECOND_SQUARED);
  switch (event.kind) {
    case 'hard-brake':
      return `GPS speed dropped about ${rate} mph per second from ${mph} mph.`;
    case 'rapid-acceleration':
      return `GPS speed rose about ${rate} mph per second, reaching ${mph} mph.`;
    case 'sharp-turn':
      return `GPS heading changed quickly at ${mph} mph.`;
    case 'full-stop':
      return 'GPS speed reached zero before moving again.';
    case 'stop-sign-complete':
      return 'The map shows a stop sign here, and GPS speed reached zero.';
    case 'rolling-stop':
      return `The map shows a stop sign here. GPS speed stayed at about ${mph} mph or more.`;
    case 'over-mapped-limit':
      return `The map shows a ${event.limitMph} mph limit. GPS estimated about ${mph} mph.`;
    case 'camera-stop-complete':
      return 'The road camera detected a stop sign, and GPS speed reached zero.';
    case 'camera-rolling-stop':
      return `The road camera detected a stop sign. GPS speed stayed at about ${mph} mph or more.`;
    case 'close-following':
      return `The road camera estimated about ${event.magnitude.toFixed(1)} seconds behind the vehicle ahead at ${mph} mph. This is a rough estimate.`;
    case 'head-check-before-turn':
      return 'The driver camera saw a head turn in the seconds before the turn.';
    case 'no-head-check-before-turn':
      return 'The driver camera saw no head turn in the seconds before the turn.';
    case 'eyes-off-road':
      return `The driver camera saw the head turned away for about ${event.magnitude.toFixed(1)} seconds at ${mph} mph.`;
    case 'scanned-at-stop':
      return `The driver camera saw ${Math.round(event.magnitude)} head turns before leaving the stop sign.`;
    case 'no-scan-at-stop':
      return `The driver camera saw ${Math.round(event.magnitude)} head turn${Math.round(event.magnitude) === 1 ? '' : 's'} before leaving the stop sign. Scan left, right, and left.`;
  }
}

/** Decides whether a measured event should be spoken now, and what to say. */
export function chooseSpokenCue(state: CoachVoiceState, event: CoachableEvent) {
  const cue = cues[event.kind];
  if (!cue.spoken) return { state, spoken: null };
  const secondsSince = (at: number | null) => (at === null ? Number.POSITIVE_INFINITY : (event.at - at) / 1000);
  if (secondsSince(state.lastSpokenAt) < MIN_SECONDS_BETWEEN_CUES) return { state, spoken: null };
  if (cue.praise && secondsSince(state.lastPraiseAt) < MIN_SECONDS_BETWEEN_PRAISE) return { state, spoken: null };
  return {
    state: {
      lastSpokenAt: event.at,
      lastPraiseAt: cue.praise ? event.at : state.lastPraiseAt,
    },
    spoken: cue.spoken(event),
  };
}

export function recordEvent(events: DriveEventRecord[] | undefined, event: CoachableEvent, secondsIntoDrive: number) {
  const next: DriveEventRecord = {
    kind: event.kind,
    secondsIntoDrive,
    speedMph: Math.round(event.speedMph * 10) / 10,
    magnitude: Math.round(event.magnitude * 100) / 100,
    ...(event.limitMph === undefined ? {} : { limitMph: event.limitMph }),
  };
  return [...(events ?? []), next].slice(-MAX_STORED_EVENTS);
}

/**
 * The AI debrief receives counts only: no times, speeds, or places.
 * That keeps the request to the minimal summary the privacy rules allow.
 */
export function summarizeForDebrief(events: DriveEventRecord[] | undefined): DebriefEvent[] {
  const counts = new Map<DriveEventKind, number>();
  for (const event of events ?? []) counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({
    kind: cues[kind].debriefKind,
    title: `${cues[kind].title}: ${count}`,
    detail: kind === 'full-stop'
      ? `GPS measured ${count} complete stop${count === 1 ? '' : 's'}.`
      : MAP_KINDS.has(kind)
        ? `Measured ${count} time${count === 1 ? '' : 's'} using GPS and OpenStreetMap data.`
        : CAMERA_KINDS.has(kind)
          ? `Tagged ${count} time${count === 1 ? '' : 's'} by on-device camera detection, which can be wrong.`
          : `GPS measured ${count} ${cues[kind].title.toLowerCase()} moment${count === 1 ? '' : 's'}.`,
  }));
}
