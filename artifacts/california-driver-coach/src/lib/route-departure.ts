import type { RouteCoordinate } from './route-coach';

/** Distance from the planned line that counts as leaving it, before GPS uncertainty. */
export const ROUTE_DEPARTURE_METERS = 90;
/** How long a trusted fix must stay past the line before a return path is requested. */
export const ROUTE_DEPARTURE_HOLD_MS = 10_000;
/**
 * Matches the speed estimate's accuracy gate. Looser fixes are ignored.
 * A trusted fix still has to clear the 90 meter line plus its own accuracy.
 */
export const TRUSTED_DEPARTURE_ACCURACY_METERS = 100;

export const routeDepartureCue = {
  title: 'Away from the planned line',
  detail: 'GPS is away from the planned line. Calculating a path back.',
  failure: 'GPS is still away from the planned line. Continue with the supervising driver. A return path is unavailable right now.',
} as const;

export type RouteDepartureState = {
  offRouteSince: number | null;
  rerouting: boolean;
};

export const initialRouteDepartureState: RouteDepartureState = {
  offRouteSince: null,
  rerouting: false,
};

export type RouteDepartureSample = {
  latitude: number;
  longitude: number;
  now: number;
  coordinates: RouteCoordinate[];
  accuracyMeters: number;
  movementPlausible: boolean;
};

export type RouteDepartureDecision =
  | { action: 'ignored'; reason: 'untrusted-fix' | 'reroute-in-progress'; state: RouteDepartureState }
  | { action: 'on-route'; state: RouteDepartureState; nearestMeters: number }
  | { action: 'holding'; state: RouteDepartureState; nearestMeters: number; heldMs: number }
  | { action: 'reroute'; state: RouteDepartureState; nearestMeters: number; cue: typeof routeDepartureCue };

export function isTrustedDepartureFix(accuracyMeters: number, movementPlausible: boolean) {
  return movementPlausible
    && Number.isFinite(accuracyMeters)
    && accuracyMeters >= 0
    && accuracyMeters <= TRUSTED_DEPARTURE_ACCURACY_METERS;
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestRouteDistanceMeters(latitude: number, longitude: number, coordinates: RouteCoordinate[]) {
  if (coordinates.length === 0) return Number.POSITIVE_INFINITY;
  const stride = Math.max(1, Math.floor(coordinates.length / 120));
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < coordinates.length; index += stride) {
    const coordinate = coordinates[index];
    nearest = Math.min(nearest, distanceMeters(latitude, longitude, coordinate[1], coordinate[0]));
  }
  const last = coordinates[coordinates.length - 1];
  return Math.min(nearest, distanceMeters(latitude, longitude, last[1], last[0]));
}

function leftThePlannedLine(nearestMeters: number, accuracyMeters: number) {
  return nearestMeters > ROUTE_DEPARTURE_METERS + accuracyMeters;
}

export function evaluateRouteDeparture(previous: RouteDepartureState, sample: RouteDepartureSample): RouteDepartureDecision {
  if (!isTrustedDepartureFix(sample.accuracyMeters, sample.movementPlausible)) {
    return { action: 'ignored', reason: 'untrusted-fix', state: previous };
  }

  const nearestMeters = nearestRouteDistanceMeters(sample.latitude, sample.longitude, sample.coordinates);
  if (!leftThePlannedLine(nearestMeters, sample.accuracyMeters)) {
    return {
      action: 'on-route',
      nearestMeters,
      state: { ...previous, offRouteSince: null },
    };
  }

  if (previous.rerouting) {
    return { action: 'ignored', reason: 'reroute-in-progress', state: previous };
  }

  const offRouteSince = previous.offRouteSince ?? sample.now;
  const heldMs = sample.now - offRouteSince;
  const state = { ...previous, offRouteSince };
  if (heldMs <= ROUTE_DEPARTURE_HOLD_MS) {
    return { action: 'holding', state, nearestMeters, heldMs };
  }

  return {
    action: 'reroute',
    nearestMeters,
    cue: routeDepartureCue,
    state: { ...state, rerouting: true },
  };
}

export function finishRouteDeparture(state: RouteDepartureState, outcome: 'returned' | 'failed'): RouteDepartureState {
  if (outcome === 'returned') return initialRouteDepartureState;
  return { ...state, rerouting: false };
}
