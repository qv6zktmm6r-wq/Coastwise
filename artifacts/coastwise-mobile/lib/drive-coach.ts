import type { DriveSignal, DriveSignalKind } from './drive-signals';
import type { MapEvent, MapEventKind } from './maneuvers';

export type DriveEventKind = DriveSignalKind | MapEventKind;

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

type CoachableEvent = (DriveSignal | MapEvent) & { limitMph?: number };

export const initialCoachVoiceState: CoachVoiceState = { lastSpokenAt: null, lastPraiseAt: null };
export const MAX_STORED_EVENTS = 300;
/** One cue at a time. Never stack instructions while the student is handling the car. */
export const MIN_SECONDS_BETWEEN_CUES = 6;
/** Praise is useful when it is rare. */
export const MIN_SECONDS_BETWEEN_PRAISE = 180;

const MPH_PER_METER_PER_SECOND_SQUARED = 2.236936;

const cues: Record<DriveEventKind, {
  title: string;
  spoken: (event: Pick<CoachableEvent, 'speedMph' | 'limitMph'>) => string;
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
};

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
  }
}

/** Decides whether a measured event should be spoken now, and what to say. */
export function chooseSpokenCue(state: CoachVoiceState, event: CoachableEvent) {
  const cue = cues[event.kind];
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
      : kind === 'stop-sign-complete' || kind === 'rolling-stop' || kind === 'over-mapped-limit'
        ? `Measured ${count} time${count === 1 ? '' : 's'} using GPS and OpenStreetMap data.`
        : `GPS measured ${count} ${cues[kind].title.toLowerCase()} moment${count === 1 ? '' : 's'}.`,
  }));
}
