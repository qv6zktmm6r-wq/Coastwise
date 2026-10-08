/**
 * Driver attention from the front camera. iOS reports only a face box and head
 * angles (yaw). No image, identity, or face data is stored.
 */
export type FaceReading = { visible: boolean; yawDegrees: number | null };

export type AttentionSample = {
  timestamp: number;
  speedMetersPerSecond: number | null;
  headingDegrees: number | null;
  /** Null when face tracking is off or unavailable. */
  face: FaceReading | null;
};

export type AttentionEventKind = 'head-check-before-turn' | 'no-head-check-before-turn' | 'eyes-off-road';

export type AttentionEvent = {
  kind: AttentionEventKind;
  at: number;
  speedMph: number;
  /** Seconds looking away for eyes-off-road; head turns counted for turn checks. */
  magnitude: number;
};

type Visibility = { at: number; visible: boolean };

export type AttentionState = {
  away: boolean;
  awaySince: number | null;
  headTurns: number[];
  visibility: Visibility[];
  headings: Array<{ at: number; heading: number }>;
  lastTurnAt: number | null;
  lastEyesOffAt: number | null;
};

export const initialAttentionState: AttentionState = {
  away: false,
  awaySince: null,
  headTurns: [],
  visibility: [],
  headings: [],
  lastTurnAt: null,
  lastEyesOffAt: null,
};

const MPH = 2.236936;
/** iOS face yaw arrives in coarse steps; 40° separates a real head turn from small movements. */
export const HEAD_TURN_YAW_DEGREES = 40;
/** Face tracking counts as reliable only if the face was visible most of the recent time. */
const RELIABILITY_WINDOW_MS = 10_000;
const RELIABLE_VISIBLE_SHARE = 0.5;
const HISTORY_MS = 60_000;
const TURN_WINDOW_MS = 12_000;
export const TURN_DEGREES = 60;
const TURN_MIN_SPEED = 3;
const TURN_QUIET_MS = 10_000;
const CHECK_BEFORE_TURN_MS = 6_000;
const CHECK_AFTER_TURN_START_MS = 1_000;
/** Common US distraction guidance: glances away from the road should stay under 2 seconds. */
export const EYES_OFF_ROAD_MS = 2_000;
const EYES_OFF_MIN_SPEED = 4.5;
const EYES_OFF_REPEAT_MS = 30_000;
/** Scanning at a stop means looking away from straight ahead at least twice (for example left, then right). */
export const STOP_SCAN_HEAD_TURNS = 2;

function angleBetween(a: number, b: number) {
  return Math.abs(((b - a + 540) % 360) - 180);
}

function signedChange(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

export function trackingReliable(state: AttentionState, now: number) {
  const recent = state.visibility.filter((entry) => now - entry.at <= RELIABILITY_WINDOW_MS);
  if (recent.length < 5) return false;
  return recent.filter((entry) => entry.visible).length / recent.length >= RELIABLE_VISIBLE_SHARE;
}

export function headTurnsBetween(state: AttentionState, from: number, to: number) {
  return state.headTurns.filter((at) => at >= from && at <= to).length;
}

/** For a stop graded at `at`: did the student scan in the 15 seconds before? Null when tracking was unreliable. */
export function stopScanVerdict(state: AttentionState, at: number) {
  if (!trackingReliable(state, at)) return null;
  const turns = headTurnsBetween(state, at - 15_000, at);
  return { scanned: turns >= STOP_SCAN_HEAD_TURNS, headTurns: turns };
}

export function evaluateAttention(previous: AttentionState, sample: AttentionSample) {
  const now = sample.timestamp;
  const events: AttentionEvent[] = [];
  if (!sample.face) return { state: previous, events };

  const state: AttentionState = {
    ...previous,
    headTurns: previous.headTurns.filter((at) => now - at <= HISTORY_MS),
    visibility: [...previous.visibility.filter((entry) => now - entry.at <= RELIABILITY_WINDOW_MS), { at: now, visible: sample.face.visible }],
    headings: previous.headings.filter((entry) => now - entry.at <= TURN_WINDOW_MS),
  };
  const speed = sample.speedMetersPerSecond ?? 0;
  const reliable = trackingReliable(state, now);

  const turnedHead = sample.face.visible
    ? sample.face.yawDegrees !== null && Math.abs(sample.face.yawDegrees) >= HEAD_TURN_YAW_DEGREES
    : reliable;
  if (turnedHead && !state.away) {
    state.away = true;
    state.awaySince = now;
    state.headTurns = [...state.headTurns, now];
  } else if (!turnedHead && state.away) {
    state.away = false;
    state.awaySince = null;
  }

  if (sample.headingDegrees !== null && sample.headingDegrees >= 0 && speed >= TURN_MIN_SPEED) {
    state.headings = [...state.headings, { at: now, heading: sample.headingDegrees }];
  }
  const turnQuiet = state.lastTurnAt !== null && now - state.lastTurnAt < TURN_QUIET_MS;
  const latest = state.headings.at(-1);
  if (!turnQuiet && latest && latest.at === now) {
    const start = state.headings.find((entry) => angleBetween(entry.heading, latest.heading) >= TURN_DEGREES);
    if (start) {
      state.lastTurnAt = now;
      state.headings = [];
      const turnStartedAt = turnStart(previous.headings, start, latest.heading);
      if (reliable) {
        const checks = headTurnsBetween(state, turnStartedAt - CHECK_BEFORE_TURN_MS, turnStartedAt + CHECK_AFTER_TURN_START_MS);
        events.push({
          kind: checks > 0 ? 'head-check-before-turn' : 'no-head-check-before-turn',
          at: now,
          speedMph: speed * MPH,
          magnitude: checks,
        });
      }
    }
  }

  const inTurn = state.lastTurnAt !== null && now - state.lastTurnAt < TURN_QUIET_MS;
  const awayFor = state.away && state.awaySince !== null ? now - state.awaySince : 0;
  const eyesOffRepeatOk = state.lastEyesOffAt === null || now - state.lastEyesOffAt >= EYES_OFF_REPEAT_MS;
  if (reliable && !inTurn && speed >= EYES_OFF_MIN_SPEED && awayFor >= EYES_OFF_ROAD_MS && eyesOffRepeatOk) {
    state.lastEyesOffAt = now;
    events.push({ kind: 'eyes-off-road', at: now, speedMph: speed * MPH, magnitude: awayFor / 1000 });
  }

  return { state, events };
}

/** The turn starts when heading first moves 10° toward its final direction. */
function turnStart(headings: AttentionState['headings'], fallback: { at: number; heading: number }, finalHeading: number) {
  const direction = Math.sign(signedChange(fallback.heading, finalHeading));
  for (const entry of headings) {
    if (entry.at < fallback.at) continue;
    if (Math.sign(signedChange(fallback.heading, entry.heading)) === direction && angleBetween(fallback.heading, entry.heading) >= 10) {
      return entry.at;
    }
  }
  return fallback.at;
}
