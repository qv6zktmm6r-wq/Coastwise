import { distanceMeters } from './drive-distance';
import { bearingDegrees, type MapFeatures, type MappedStop } from './map-data';

export type MapSample = {
  latitude: number;
  longitude: number;
  speedMetersPerSecond: number | null;
  headingDegrees: number | null;
  accuracyMeters: number | null;
  timestamp: number;
};

export type MapEventKind = 'stop-sign-complete' | 'rolling-stop' | 'over-mapped-limit';

export type MapEvent = {
  kind: MapEventKind;
  at: number;
  speedMph: number;
  limitMph?: number;
  /** Slowest GPS speed near the stop (m/s), or mph over the mapped limit. */
  magnitude: number;
};

type StopApproach = {
  stopId: string;
  startedAt: number;
  closestMeters: number;
  lastMeters: number;
  recedingSamples: number;
  minSpeedNearStop: number;
};

export type ManeuverState = {
  approach: StopApproach | null;
  lastGradedAt: number | null;
  currentLimitMph: number | null;
  overLimitSince: number | null;
  lastOverLimitAt: number | null;
};

export const initialManeuverState: ManeuverState = {
  approach: null,
  lastGradedAt: null,
  currentLimitMph: null,
  overLimitSince: null,
  lastOverLimitAt: null,
};

const MPH = 2.236936;
const MAX_ACCURACY_METERS = 20;
const ALIGNED_DEGREES = 35;
const MIN_HEADING_SPEED = 3;
const APPROACH_FAR_METERS = 45;
/** The approach must be seen from outside this range, so a car already past the stop is never graded. */
const APPROACH_NEAR_METERS = 20;
const STOP_ZONE_METERS = 20;
const SPEED_WINDOW_METERS = 25;
export const FULL_STOP_METERS_PER_SECOND = 0.5;
/** About 10 mph. A car that never slowed below this was probably not facing this stop sign. */
export const ROLLING_STOP_MAX_METERS_PER_SECOND = 4.5;
/** Two-way stop nodes sit on both sides of an intersection; skip the far one after grading the near one. */
const AFTER_GRADE_QUIET_MS = 25_000;
const APPROACH_TIMEOUT_MS = 120_000;
const SPEED_WAY_MATCH_METERS = 20;
export const OVER_LIMIT_MARGIN_MPH = 5;
const OVER_LIMIT_HOLD_MS = 5_000;
const OVER_LIMIT_REPEAT_MS = 60_000;

function angleBetween(a: number, b: number) {
  return Math.abs(((b - a + 540) % 360) - 180);
}

function distanceToSegmentMeters(latitude: number, longitude: number, a: [number, number], b: [number, number]) {
  const metersPerLongitude = 111_320 * Math.cos(latitude * Math.PI / 180);
  const metersPerLatitude = 110_540;
  const ax = (a[1] - longitude) * metersPerLongitude;
  const ay = (a[0] - latitude) * metersPerLatitude;
  const bx = (b[1] - longitude) * metersPerLongitude;
  const by = (b[0] - latitude) * metersPerLatitude;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Finds the mapped limit of the road the car is driving along, or null when no mapped road matches. */
export function matchSpeedLimit(features: MapFeatures, latitude: number, longitude: number, heading: number | null) {
  let best: { limitMph: number; meters: number } | null = null;
  for (const way of features.speedWays) {
    for (let index = 1; index < way.points.length; index += 1) {
      const a = way.points[index - 1];
      const b = way.points[index];
      const meters = distanceToSegmentMeters(latitude, longitude, a, b);
      if (meters > SPEED_WAY_MATCH_METERS || (best && meters >= best.meters)) continue;
      if (heading !== null) {
        const roadBearing = bearingDegrees(a, b);
        const along = Math.min(angleBetween(heading, roadBearing), angleBetween(heading, (roadBearing + 180) % 360));
        if (along > ALIGNED_DEGREES) continue;
      }
      best = { limitMph: way.limitMph, meters };
    }
  }
  return best?.limitMph ?? null;
}

function findApproach(features: MapFeatures, sample: MapSample, heading: number) {
  let best: { stop: MappedStop; meters: number } | null = null;
  for (const stop of features.stops) {
    const meters = distanceMeters(sample.latitude, sample.longitude, stop.latitude, stop.longitude);
    if (meters < APPROACH_NEAR_METERS || meters > APPROACH_FAR_METERS) continue;
    if (!stop.approachBearings.some((bearing) => angleBetween(heading, bearing) <= ALIGNED_DEGREES)) continue;
    const towardStop = bearingDegrees([sample.latitude, sample.longitude], [stop.latitude, stop.longitude]);
    if (angleBetween(heading, towardStop) > ALIGNED_DEGREES * 1.5) continue;
    if (!best || meters < best.meters) best = { stop, meters };
  }
  return best;
}

/**
 * Grades stop-sign approaches and speed against mapped limits. Every event names
 * the map as its source, because the phone did not see the sign itself.
 */
export function evaluateManeuvers(previous: ManeuverState, features: MapFeatures, sample: MapSample) {
  const speed = sample.speedMetersPerSecond;
  const accuracy = sample.accuracyMeters;
  if (speed === null || !Number.isFinite(speed) || speed < 0) return { state: previous, events: [] as MapEvent[] };
  if (accuracy === null || !Number.isFinite(accuracy) || accuracy > MAX_ACCURACY_METERS) {
    return { state: previous, events: [] as MapEvent[] };
  }

  const state: ManeuverState = { ...previous };
  const events: MapEvent[] = [];
  const now = sample.timestamp;
  const speedMph = speed * MPH;
  const heading = sample.headingDegrees !== null && sample.headingDegrees >= 0 && speed >= MIN_HEADING_SPEED
    ? sample.headingDegrees
    : null;

  if (heading !== null) state.currentLimitMph = matchSpeedLimit(features, sample.latitude, sample.longitude, heading);
  if (state.currentLimitMph !== null && speedMph >= state.currentLimitMph + OVER_LIMIT_MARGIN_MPH) {
    state.overLimitSince ??= now;
    const repeatOk = state.lastOverLimitAt === null || now - state.lastOverLimitAt >= OVER_LIMIT_REPEAT_MS;
    if (now - state.overLimitSince >= OVER_LIMIT_HOLD_MS && repeatOk) {
      state.lastOverLimitAt = now;
      events.push({
        kind: 'over-mapped-limit',
        at: now,
        speedMph,
        limitMph: state.currentLimitMph,
        magnitude: speedMph - state.currentLimitMph,
      });
    }
  } else {
    state.overLimitSince = null;
  }

  if (state.approach) {
    const stop = features.stops.find((candidate) => candidate.id === state.approach!.stopId);
    if (!stop) {
      state.approach = null;
    } else {
      const meters = distanceMeters(sample.latitude, sample.longitude, stop.latitude, stop.longitude);
      const approach = { ...state.approach };
      if (meters <= SPEED_WINDOW_METERS) approach.minSpeedNearStop = Math.min(approach.minSpeedNearStop, speed);
      approach.recedingSamples = meters > approach.lastMeters + 1 ? approach.recedingSamples + 1 : 0;
      approach.closestMeters = Math.min(approach.closestMeters, meters);
      approach.lastMeters = meters;
      const passed = approach.recedingSamples >= 2 && meters > approach.closestMeters + 8;
      const abandoned = now - approach.startedAt > APPROACH_TIMEOUT_MS || meters > APPROACH_FAR_METERS + 15;
      if (passed || abandoned) {
        state.approach = null;
        if (approach.closestMeters <= STOP_ZONE_METERS) {
          if (approach.minSpeedNearStop <= FULL_STOP_METERS_PER_SECOND) {
            events.push({ kind: 'stop-sign-complete', at: now, speedMph: 0, magnitude: approach.minSpeedNearStop });
            state.lastGradedAt = now;
          } else if (approach.minSpeedNearStop < ROLLING_STOP_MAX_METERS_PER_SECOND) {
            events.push({
              kind: 'rolling-stop',
              at: now,
              speedMph: approach.minSpeedNearStop * MPH,
              magnitude: approach.minSpeedNearStop,
            });
            state.lastGradedAt = now;
          }
        }
      } else {
        state.approach = approach;
      }
    }
  }

  const quiet = state.lastGradedAt !== null && now - state.lastGradedAt < AFTER_GRADE_QUIET_MS;
  if (!state.approach && !quiet && heading !== null) {
    const found = findApproach(features, sample, heading);
    if (found) {
      state.approach = {
        stopId: found.stop.id,
        startedAt: now,
        closestMeters: found.meters,
        lastMeters: found.meters,
        recedingSamples: 0,
        minSpeedNearStop: Number.POSITIVE_INFINITY,
      };
    }
  }

  return { state, events };
}
