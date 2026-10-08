export type DistanceFix = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  timestamp: number;
};

export type DistanceStep = {
  anchor: DistanceFix | null;
  meters: number;
};

export const METERS_PER_MILE = 1609.344;
export const MAX_FIX_ACCURACY_METERS = 50;
/** About 100 mph. Faster apparent movement is a GPS jump, not driving. */
export const MAX_PLAUSIBLE_METERS_PER_SECOND = 45;
/** Longer gaps (for example after a pause) restart measurement instead of guessing the path. */
export const MAX_GAP_SECONDS = 60;
const MIN_NOISE_FLOOR_METERS = 5;
const MAX_NOISE_FLOOR_METERS = 30;

export function distanceMeters(latitude1: number, longitude1: number, latitude2: number, longitude2: number) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isAccurate(fix: DistanceFix) {
  return fix.accuracyMeters !== null
    && Number.isFinite(fix.accuracyMeters)
    && fix.accuracyMeters >= 0
    && fix.accuracyMeters <= MAX_FIX_ACCURACY_METERS;
}

/**
 * Adds one GPS fix to the running measurement. The anchor only moves once the car
 * has clearly left GPS noise, so a parked phone does not collect phantom miles.
 */
export function addDistanceFix(anchor: DistanceFix | null, fix: DistanceFix): DistanceStep {
  if (!isAccurate(fix)) return { anchor, meters: 0 };
  if (!anchor) return { anchor: fix, meters: 0 };
  const seconds = (fix.timestamp - anchor.timestamp) / 1000;
  if (seconds <= 0) return { anchor, meters: 0 };
  if (seconds > MAX_GAP_SECONDS) return { anchor: fix, meters: 0 };
  const meters = distanceMeters(anchor.latitude, anchor.longitude, fix.latitude, fix.longitude);
  if (meters / seconds > MAX_PLAUSIBLE_METERS_PER_SECOND) return { anchor, meters: 0 };
  const noiseFloor = Math.min(MAX_NOISE_FLOOR_METERS, Math.max(MIN_NOISE_FLOOR_METERS, fix.accuracyMeters ?? 0));
  if (meters < noiseFloor) return { anchor, meters: 0 };
  return { anchor: fix, meters };
}
