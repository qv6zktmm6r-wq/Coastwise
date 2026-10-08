import { distanceMeters, METERS_PER_MILE } from './drive-distance.ts';

/** [longitude, latitude], as returned by OSRM. */
export type RouteCoordinate = [number, number];

export type RouteStep = {
  instruction: string;
  location: RouteCoordinate;
  arrive: boolean;
};

export type PlannedRoute = {
  coordinates: RouteCoordinate[];
  steps: RouteStep[];
  distanceMeters: number;
  durationSeconds: number;
  origin: RouteCoordinate;
};

export const ROUTE_SERVICE_HOST = 'router.project-osrm.org';
/** Three decimals is roughly 100 m; the routing service never sees the exact spot. */
const ORIGIN_DECIMALS = 3;
const REQUEST_TIMEOUT_MS = 12_000;
const ANNOUNCE_AHEAD_METERS = 160;
const STEP_REACHED_METERS = 30;
const FEET_PER_METER = 3.28084;

type OsrmStep = {
  distance: number;
  name?: string;
  maneuver: { location: RouteCoordinate; modifier?: string; type?: string };
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: RouteCoordinate[] };
  legs: Array<{ steps: OsrmStep[] }>;
};

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

function roundCoordinate(value: number) {
  const factor = 10 ** ORIGIN_DECIMALS;
  return Math.round(value * factor) / factor;
}

function instructionFor(step: OsrmStep) {
  const road = step.name ? ` onto ${step.name}` : '';
  const modifier = step.maneuver.modifier ?? 'straight';
  if (step.maneuver.type === 'arrive') return 'You are back at the start. Park when it is safe, then stop the drive.';
  if (step.maneuver.type === 'roundabout' || step.maneuver.type === 'rotary') return `Enter the roundabout${road}`;
  if (modifier === 'uturn') return `Make a U-turn where it is legal${road}`;
  if (modifier.includes('slight') && modifier.includes('left')) return `Keep left${road}`;
  if (modifier.includes('slight') && modifier.includes('right')) return `Keep right${road}`;
  if (modifier.includes('left')) return `Turn left${road}`;
  if (modifier.includes('right')) return `Turn right${road}`;
  return `Continue straight${road}`;
}

/**
 * Loop waypoints around the start, in units of the loop radius. Each variant
 * rotates the loop and alternates its direction, so regenerating gives a
 * different set of streets.
 */
export function loopWaypoints(latitude: number, longitude: number, minutes: number, variant: number): RouteCoordinate[] {
  const distanceMiles = Math.max(0.7, minutes * 0.18);
  const radiusMiles = Math.min(2.2, Math.max(0.25, distanceMiles / 4));
  const latOffset = radiusMiles / 69;
  const lonOffset = radiusMiles / (69 * Math.max(0.35, Math.cos(latitude * Math.PI / 180)));
  const angle = (variant * 137.5 * Math.PI) / 180;
  const shape: Array<[number, number]> = [[1, 0.28], [0.18, 1], [-1, 0.15]];
  const ordered = variant % 2 === 1 ? [...shape].reverse() : shape;
  const around = ordered.map(([x, y]): RouteCoordinate => {
    const rx = x * Math.cos(angle) - y * Math.sin(angle);
    const ry = x * Math.sin(angle) + y * Math.cos(angle);
    return [longitude + rx * lonOffset, latitude + ry * latOffset];
  });
  return [[longitude, latitude], ...around, [longitude, latitude]];
}

export async function requestPracticeLoop(
  latitude: number,
  longitude: number,
  minutes: number,
  variant: number,
  fetchImpl: FetchLike = fetch,
): Promise<PlannedRoute> {
  const lat = roundCoordinate(latitude);
  const lon = roundCoordinate(longitude);
  const coordinates = loopWaypoints(lat, lon, minutes, variant)
    .map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`)
    .join(';');
  const url = `https://${ROUTE_SERVICE_HOST}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&continue_straight=true`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Route service returned ${response.status}`);
      const data = await response.json() as { code?: string; routes?: OsrmRoute[] };
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route) throw new Error('No nearby driving loop was found');
      return {
        coordinates: route.geometry.coordinates,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        origin: [lon, lat],
        steps: route.legs.flatMap((leg) => leg.steps)
          .filter((step) => step.maneuver.type !== 'depart' && step.maneuver.type !== 'arrive' && step.distance > 12)
          .concat(route.legs.at(-1)?.steps.filter((step) => step.maneuver.type === 'arrive').slice(-1) ?? [])
          .map((step) => ({
            instruction: instructionFor(step),
            location: step.maneuver.location,
            arrive: step.maneuver.type === 'arrive',
          })),
      };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Route service unavailable');
}

export type GuidanceState = { stepIndex: number; announcedIndex: number };
export const initialGuidanceState: GuidanceState = { stepIndex: 0, announcedIndex: -1 };

function spokenDistance(meters: number) {
  const feet = meters * FEET_PER_METER;
  if (feet < 528) return `In about ${Math.max(50, Math.round(feet / 50) * 50)} feet`;
  return `In about ${(meters / METERS_PER_MILE).toFixed(1)} miles`;
}

/**
 * Advances turn-by-turn guidance for one GPS fix. Returns a cue to speak when
 * a turn is coming up, or when the route is finished.
 */
export function advanceGuidance(
  route: PlannedRoute,
  state: GuidanceState,
  latitude: number,
  longitude: number,
): { state: GuidanceState; cue: string | null; nextInstruction: string | null } {
  let { stepIndex, announcedIndex } = state;
  const distanceTo = (index: number) => {
    const [lon, lat] = route.steps[index].location;
    return distanceMeters(latitude, longitude, lat, lon);
  };
  // Jump past any turn reached, including later ones if the driver skipped a turn.
  for (let index = route.steps.length - 1; index >= stepIndex; index -= 1) {
    if (!route.steps[index].arrive && distanceTo(index) <= STEP_REACHED_METERS) {
      stepIndex = index + 1;
      break;
    }
  }
  const step = route.steps[stepIndex];
  if (!step) return { state: { stepIndex, announcedIndex }, cue: null, nextInstruction: null };
  const meters = distanceTo(stepIndex);
  let cue: string | null = null;
  if (step.arrive) {
    // The loop starts and ends at the same place, so only finish after some progress.
    if (stepIndex > 0 && meters <= STEP_REACHED_METERS * 2 && announcedIndex < stepIndex) {
      cue = step.instruction;
      announcedIndex = stepIndex;
    }
  } else if (meters <= ANNOUNCE_AHEAD_METERS && announcedIndex < stepIndex) {
    cue = `${spokenDistance(meters)}, ${step.instruction.charAt(0).toLowerCase()}${step.instruction.slice(1)}.`;
    announcedIndex = stepIndex;
  }
  return { state: { stepIndex, announcedIndex }, cue, nextInstruction: step.instruction };
}

export function describeRoute(route: PlannedRoute) {
  const miles = route.distanceMeters / METERS_PER_MILE;
  const minutes = Math.max(1, Math.round(route.durationSeconds / 60));
  const turns = route.steps.filter((step) => !step.arrive && !step.instruction.startsWith('Continue')).length;
  return `${miles.toFixed(1)} mi · about ${minutes} min · ${turns} turns`;
}
