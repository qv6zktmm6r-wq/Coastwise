export type SignalSample = {
  /** Speed reported by the GPS chip. iOS derives it from Doppler shift, which is far steadier than position deltas. */
  speedMetersPerSecond: number | null;
  headingDegrees: number | null;
  accuracyMeters: number | null;
  timestamp: number;
};

export type DriveSignalKind = 'hard-brake' | 'rapid-acceleration' | 'sharp-turn' | 'full-stop';

export type DriveSignal = {
  kind: DriveSignalKind;
  at: number;
  speedMph: number;
  /** m/s² for braking, acceleration, and turning. Seconds held for a full stop. */
  magnitude: number;
};

type TrustedSample = { speed: number; heading: number | null; timestamp: number };

export type SignalState = {
  previous: TrustedSample | null;
  movedSinceLastStop: boolean;
  stoppedSince: number | null;
  stopReported: boolean;
  lastEmitted: Partial<Record<DriveSignalKind, number>>;
};

export const initialSignalState: SignalState = {
  previous: null,
  movedSinceLastStop: false,
  stoppedSince: null,
  stopReported: false,
  lastEmitted: {},
};

export const MPH_PER_METER_PER_SECOND = 2.236936;
export const MAX_SIGNAL_ACCURACY_METERS = 30;
/** About 7 mph per second, the threshold insurers commonly use for a hard brake. */
export const HARD_BRAKE_METERS_PER_SECOND_SQUARED = 3.1;
export const RAPID_ACCELERATION_METERS_PER_SECOND_SQUARED = 3.1;
/** About 0.4 g sideways. */
export const SHARP_TURN_METERS_PER_SECOND_SQUARED = 4;
/** About 10 mph. Below this, GPS speed and heading are too noisy to judge braking or turning. */
export const MIN_EVENT_SPEED_METERS_PER_SECOND = 4.5;
export const STOPPED_METERS_PER_SECOND = 0.5;
export const FULL_STOP_HOLD_MS = 1_000;
const MOVING_AGAIN_METERS_PER_SECOND = 2;
const MIN_SAMPLE_SECONDS = 0.5;
const MAX_SAMPLE_SECONDS = 3;
const EVENT_COOLDOWN_MS = 8_000;

function trusted(sample: SignalSample): TrustedSample | null {
  const { speedMetersPerSecond: speed, accuracyMeters: accuracy } = sample;
  if (speed === null || !Number.isFinite(speed) || speed < 0 || speed > 60) return null;
  if (accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > MAX_SIGNAL_ACCURACY_METERS) return null;
  const heading = sample.headingDegrees !== null
    && Number.isFinite(sample.headingDegrees)
    && sample.headingDegrees >= 0
    && speed >= MIN_EVENT_SPEED_METERS_PER_SECOND
    ? sample.headingDegrees
    : null;
  return { speed, heading, timestamp: sample.timestamp };
}

function headingChangeDegrees(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

/** Turns one GPS reading into driving events the phone actually measured. */
export function evaluateSignals(previousState: SignalState, sample: SignalSample) {
  const current = trusted(sample);
  if (!current) return { state: previousState, signals: [] as DriveSignal[], speedMph: null };

  const state: SignalState = { ...previousState, lastEmitted: { ...previousState.lastEmitted }, previous: current };
  const signals: DriveSignal[] = [];
  const speedMph = current.speed * MPH_PER_METER_PER_SECOND;
  const emit = (kind: DriveSignalKind, magnitude: number, atSpeed = current.speed) => {
    const last = state.lastEmitted[kind];
    if (last !== undefined && current.timestamp - last < EVENT_COOLDOWN_MS) return;
    state.lastEmitted[kind] = current.timestamp;
    signals.push({ kind, at: current.timestamp, speedMph: atSpeed * MPH_PER_METER_PER_SECOND, magnitude });
  };

  const previous = previousState.previous;
  const seconds = previous ? (current.timestamp - previous.timestamp) / 1000 : 0;
  if (previous && seconds >= MIN_SAMPLE_SECONDS && seconds <= MAX_SAMPLE_SECONDS) {
    const acceleration = (current.speed - previous.speed) / seconds;
    if (previous.speed >= MIN_EVENT_SPEED_METERS_PER_SECOND && acceleration <= -HARD_BRAKE_METERS_PER_SECOND_SQUARED) {
      emit('hard-brake', -acceleration, previous.speed);
    }
    if (current.speed >= MIN_EVENT_SPEED_METERS_PER_SECOND && acceleration >= RAPID_ACCELERATION_METERS_PER_SECOND_SQUARED) {
      emit('rapid-acceleration', acceleration);
    }
    if (previous.heading !== null && current.heading !== null) {
      const yawRadiansPerSecond = Math.abs(headingChangeDegrees(previous.heading, current.heading)) * Math.PI / 180 / seconds;
      const lateral = ((previous.speed + current.speed) / 2) * yawRadiansPerSecond;
      if (lateral >= SHARP_TURN_METERS_PER_SECOND_SQUARED) emit('sharp-turn', lateral);
    }
  }

  if (current.speed >= MIN_EVENT_SPEED_METERS_PER_SECOND) state.movedSinceLastStop = true;
  if (current.speed <= STOPPED_METERS_PER_SECOND) {
    state.stoppedSince ??= current.timestamp;
    const held = current.timestamp - state.stoppedSince;
    if (state.movedSinceLastStop && !state.stopReported && held >= FULL_STOP_HOLD_MS) {
      state.stopReported = true;
      state.movedSinceLastStop = false;
      emit('full-stop', held / 1000, 0);
    }
  } else if (current.speed >= MOVING_AGAIN_METERS_PER_SECOND) {
    state.stoppedSince = null;
    state.stopReported = false;
  }

  return { state, signals, speedMph };
}
