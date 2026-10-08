import type { DriveSignal, DriveSignalKind } from './drive-signals';

export type DriveEventRecord = {
  kind: DriveSignalKind;
  secondsIntoDrive: number;
  speedMph: number;
  magnitude: number;
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

export const initialCoachVoiceState: CoachVoiceState = { lastSpokenAt: null, lastPraiseAt: null };
export const MAX_STORED_EVENTS = 300;
/** One cue at a time. Never stack instructions while the student is handling the car. */
export const MIN_SECONDS_BETWEEN_CUES = 6;
/** Praise is useful when it is rare. */
export const MIN_SECONDS_BETWEEN_PRAISE = 180;

const MPH_PER_METER_PER_SECOND_SQUARED = 2.236936;

const cues: Record<DriveSignalKind, { title: string; spoken: string; praise: boolean }> = {
  'hard-brake': {
    title: 'Hard braking',
    spoken: 'That was a hard stop. Look farther ahead and ease off sooner.',
    praise: false,
  },
  'rapid-acceleration': {
    title: 'Quick acceleration',
    spoken: 'Ease into the gas a little smoother.',
    praise: false,
  },
  'sharp-turn': {
    title: 'Fast turn',
    spoken: 'That turn was quick. Slow down before the turn, not during it.',
    praise: false,
  },
  'full-stop': {
    title: 'Full stop',
    spoken: 'Nice full stop.',
    praise: true,
  },
};

export function coachTitle(kind: DriveSignalKind) {
  return cues[kind].title;
}

/** States only what GPS measured, so the debrief never implies the phone saw the road. */
export function describeEvent(event: Pick<DriveEventRecord, 'kind' | 'speedMph' | 'magnitude'>) {
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
  }
}

/** Decides whether a measured event should be spoken now, and what to say. */
export function chooseSpokenCue(state: CoachVoiceState, signal: DriveSignal) {
  const cue = cues[signal.kind];
  const secondsSince = (at: number | null) => (at === null ? Number.POSITIVE_INFINITY : (signal.at - at) / 1000);
  if (secondsSince(state.lastSpokenAt) < MIN_SECONDS_BETWEEN_CUES) return { state, spoken: null };
  if (cue.praise && secondsSince(state.lastPraiseAt) < MIN_SECONDS_BETWEEN_PRAISE) return { state, spoken: null };
  return {
    state: {
      lastSpokenAt: signal.at,
      lastPraiseAt: cue.praise ? signal.at : state.lastPraiseAt,
    },
    spoken: cue.spoken,
  };
}

export function recordEvent(events: DriveEventRecord[] | undefined, signal: DriveSignal, secondsIntoDrive: number) {
  const next: DriveEventRecord = {
    kind: signal.kind,
    secondsIntoDrive,
    speedMph: Math.round(signal.speedMph * 10) / 10,
    magnitude: Math.round(signal.magnitude * 100) / 100,
  };
  return [...(events ?? []), next].slice(-MAX_STORED_EVENTS);
}

/**
 * The AI debrief receives counts only: no times, speeds, or places.
 * That keeps the request to the minimal summary the privacy rules allow.
 */
export function summarizeForDebrief(events: DriveEventRecord[] | undefined): DebriefEvent[] {
  const counts = new Map<DriveSignalKind, number>();
  for (const event of events ?? []) counts.set(event.kind, (counts.get(event.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({
    kind: kind === 'full-stop' ? 'maneuver' : 'safety',
    title: `${cues[kind].title}: ${count}`,
    detail: kind === 'full-stop'
      ? `GPS measured ${count} complete stop${count === 1 ? '' : 's'}.`
      : `GPS measured ${count} ${cues[kind].title.toLowerCase()} moment${count === 1 ? '' : 's'}.`,
  }));
}
