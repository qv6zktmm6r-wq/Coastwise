/** One object reported by the on-device detector for one camera frame. Boxes are normalized 0...1. */
export type Detection = {
  label: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type VisionFrame = {
  timestamp: number;
  detections: Detection[];
  /** GPS speed at the time of the frame, when trusted. */
  speedMetersPerSecond: number | null;
};

export type VisionEventKind = 'camera-stop-complete' | 'camera-rolling-stop' | 'close-following';

export type VisionEvent = {
  kind: VisionEventKind;
  at: number;
  speedMph: number;
  /** Slowest speed after the sign (m/s), or the estimated time gap in seconds. */
  magnitude: number;
};

type SignTrack = {
  firstSeenAt: number;
  lastSeenAt: number;
  sightings: number;
  firstWidth: number;
  confirmed: boolean;
  minSpeedAfterConfirm: number;
};

export type VisionState = {
  sign: SignTrack | null;
  lastSignGradedAt: number | null;
  followingSince: number | null;
  lastFollowingAt: number | null;
  closestGapSeconds: number | null;
};

export const initialVisionState: VisionState = {
  sign: null,
  lastSignGradedAt: null,
  followingSince: null,
  lastFollowingAt: null,
  closestGapSeconds: null,
};

const MPH = 2.236936;
export const MIN_CONFIDENCE = 0.55;
/** A sign must be seen in several frames, getting larger, before it counts. One-frame blips are ignored. */
const SIGN_CONFIRM_SIGHTINGS = 3;
const SIGN_CONFIRM_GROWTH = 1.15;
/** The sign is gone once it has been out of view this long; the stop is graded then. */
const SIGN_GONE_MS = 2_500;
const SIGN_TRACK_TIMEOUT_MS = 90_000;
const SIGN_REGRADE_QUIET_MS = 20_000;
/** Signs for the car's own lane appear on the right half of a forward view (US). */
const SIGN_MIN_CENTER_X = 0.45;
const FULL_STOP_METERS_PER_SECOND = 0.5;
const ROLLING_STOP_MAX_METERS_PER_SECOND = 4.5;

/** Typical passenger car width. */
const CAR_WIDTH_METERS = 1.8;
/**
 * Horizontal field of view of the iPhone main camera in 16:9 video, roughly 64°.
 * The estimate is coarse, so the coaching threshold leaves a wide margin.
 */
export const CAMERA_HORIZONTAL_FOV_DEGREES = 64;
const VEHICLE_LABELS = new Set(['car', 'truck', 'bus']);
/** The vehicle directly ahead is near the horizontal center of the view. */
const AHEAD_MAX_CENTER_OFFSET = 0.15;
/** Many driving guides teach at least three seconds. Coach only when clearly under two. */
export const CLOSE_FOLLOWING_SECONDS = 2;
const CLOSE_FOLLOWING_MIN_SPEED = 11;
const CLOSE_FOLLOWING_HOLD_MS = 3_000;
const CLOSE_FOLLOWING_REPEAT_MS = 60_000;

const usable = (detection: Detection) => detection.confidence >= MIN_CONFIDENCE && detection.width > 0;

/** Distance to a car ahead from how wide it appears. Assumes a typical car width. */
export function estimateDistanceMeters(boxWidth: number, horizontalFovDegrees = CAMERA_HORIZONTAL_FOV_DEGREES) {
  if (!(boxWidth > 0)) return null;
  const halfAngle = horizontalFovDegrees * Math.PI / 360;
  const focalInFrameWidths = 0.5 / Math.tan(halfAngle);
  return focalInFrameWidths * CAR_WIDTH_METERS / boxWidth;
}

function vehicleAhead(detections: Detection[]) {
  return detections
    .filter((detection) => usable(detection) && VEHICLE_LABELS.has(detection.label))
    .filter((detection) => Math.abs(detection.x + detection.width / 2 - 0.5) <= AHEAD_MAX_CENTER_OFFSET)
    .sort((a, b) => b.width - a.width)[0] ?? null;
}

function stopSignInView(detections: Detection[]) {
  return detections
    .filter((detection) => usable(detection) && detection.label === 'stop sign')
    .filter((detection) => detection.x + detection.width / 2 >= SIGN_MIN_CENTER_X)
    .sort((a, b) => b.width - a.width)[0] ?? null;
}

/**
 * Turns detector output into review tags. Camera events are tags for the debrief
 * until real-drive testing shows they are reliable enough to be spoken.
 */
export function evaluateVision(previous: VisionState, frame: VisionFrame) {
  const state: VisionState = { ...previous, sign: previous.sign ? { ...previous.sign } : null };
  const events: VisionEvent[] = [];
  const now = frame.timestamp;
  const speed = frame.speedMetersPerSecond;

  const sign = stopSignInView(frame.detections);
  const quiet = state.lastSignGradedAt !== null && now - state.lastSignGradedAt < SIGN_REGRADE_QUIET_MS;
  if (sign && !quiet) {
    if (!state.sign) {
      state.sign = {
        firstSeenAt: now,
        lastSeenAt: now,
        sightings: 1,
        firstWidth: sign.width,
        confirmed: false,
        minSpeedAfterConfirm: Number.POSITIVE_INFINITY,
      };
    } else {
      state.sign.lastSeenAt = now;
      state.sign.sightings += 1;
      if (!state.sign.confirmed
        && state.sign.sightings >= SIGN_CONFIRM_SIGHTINGS
        && sign.width >= state.sign.firstWidth * SIGN_CONFIRM_GROWTH) {
        state.sign.confirmed = true;
      }
    }
  }

  if (state.sign?.confirmed && speed !== null) {
    state.sign.minSpeedAfterConfirm = Math.min(state.sign.minSpeedAfterConfirm, speed);
  }

  if (state.sign) {
    const gone = now - state.sign.lastSeenAt >= SIGN_GONE_MS;
    const expired = now - state.sign.firstSeenAt > SIGN_TRACK_TIMEOUT_MS;
    const movingAway = speed !== null && speed >= ROLLING_STOP_MAX_METERS_PER_SECOND;
    if ((gone && movingAway) || expired) {
      const track = state.sign;
      state.sign = null;
      if (track.confirmed && Number.isFinite(track.minSpeedAfterConfirm)) {
        if (track.minSpeedAfterConfirm <= FULL_STOP_METERS_PER_SECOND) {
          events.push({ kind: 'camera-stop-complete', at: now, speedMph: 0, magnitude: track.minSpeedAfterConfirm });
          state.lastSignGradedAt = now;
        } else if (track.minSpeedAfterConfirm < ROLLING_STOP_MAX_METERS_PER_SECOND) {
          events.push({
            kind: 'camera-rolling-stop',
            at: now,
            speedMph: track.minSpeedAfterConfirm * MPH,
            magnitude: track.minSpeedAfterConfirm,
          });
          state.lastSignGradedAt = now;
        }
      }
    }
  }

  const ahead = vehicleAhead(frame.detections);
  const distance = ahead ? estimateDistanceMeters(ahead.width) : null;
  const gap = distance !== null && speed !== null && speed >= CLOSE_FOLLOWING_MIN_SPEED ? distance / speed : null;
  if (gap !== null && gap < CLOSE_FOLLOWING_SECONDS) {
    state.followingSince ??= now;
    state.closestGapSeconds = Math.min(state.closestGapSeconds ?? gap, gap);
    const repeatOk = state.lastFollowingAt === null || now - state.lastFollowingAt >= CLOSE_FOLLOWING_REPEAT_MS;
    if (now - state.followingSince >= CLOSE_FOLLOWING_HOLD_MS && repeatOk) {
      state.lastFollowingAt = now;
      events.push({ kind: 'close-following', at: now, speedMph: (speed ?? 0) * MPH, magnitude: state.closestGapSeconds });
    }
  } else {
    state.followingSince = null;
    state.closestGapSeconds = null;
  }

  return { state, events };
}
