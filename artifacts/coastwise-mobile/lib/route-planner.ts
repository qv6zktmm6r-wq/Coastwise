import { distanceMeters, METERS_PER_MILE } from './drive-distance.ts';

/** [longitude, latitude], as returned by OSRM. */
export type RouteCoordinate = [number, number];

export type ManeuverKind =
  | 'left'
  | 'right'
  | 'keep-left'
  | 'keep-right'
  | 'merge-left'
  | 'merge-right'
  | 'roundabout'
  | 'uturn'
  | 'straight'
  | 'arrive';

export type RouteStep = {
  instruction: string;
  location: RouteCoordinate;
  kind: ManeuverKind;
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
/** First call: what is coming, check mirrors, ease off. */
const PREPARE_AHEAD_METERS = 160;
/** Second call: signal now. Most US handbooks ask for a signal at least 100 feet ahead. */
const SIGNAL_AHEAD_METERS = 55;
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

export function maneuverKind(step: OsrmStep): ManeuverKind {
  const type = step.maneuver.type ?? 'turn';
  const modifier = step.maneuver.modifier ?? 'straight';
  const side = modifier.includes('left') ? 'left' : modifier.includes('right') ? 'right' : null;
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') return 'roundabout';
  if (modifier === 'uturn') return 'uturn';
  if (type === 'merge' || type === 'on ramp') return side === 'left' ? 'merge-left' : side === 'right' ? 'merge-right' : 'straight';
  if (modifier.includes('slight') || type === 'fork' || type === 'off ramp') {
    return side === 'left' ? 'keep-left' : side === 'right' ? 'keep-right' : 'straight';
  }
  return side ?? 'straight';
}

function instructionFor(step: OsrmStep, kind: ManeuverKind) {
  const road = step.name ? ` onto ${step.name}` : '';
  switch (kind) {
    case 'arrive': return 'You are back at the start. Park when it is safe, then stop the drive.';
    case 'roundabout': return `Enter the roundabout${road}`;
    case 'uturn': return `Make a U-turn where it is legal${road}`;
    case 'merge-left': return `Merge left${road}`;
    case 'merge-right': return `Merge right${road}`;
    case 'keep-left': return `Keep left${road}`;
    case 'keep-right': return `Keep right${road}`;
    case 'left': return `Turn left${road}`;
    case 'right': return `Turn right${road}`;
    default: return `Continue straight${road}`;
  }
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
          .map((step) => {
            const kind = maneuverKind(step);
            return { instruction: instructionFor(step, kind), location: step.maneuver.location, kind };
          }),
      };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Route service unavailable');
}

export type GuidanceState = { stepIndex: number; preparedIndex: number; signaledIndex: number };
export const initialGuidanceState: GuidanceState = { stepIndex: 0, preparedIndex: -1, signaledIndex: -1 };

function spokenDistance(meters: number) {
  const feet = meters * FEET_PER_METER;
  if (feet < 528) return `In about ${Math.max(50, Math.round(feet / 50) * 50)} feet`;
  return `In about ${(meters / METERS_PER_MILE).toFixed(1)} miles`;
}

function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Early call, while there is still room to slow down and position the car. */
function prepareCue(step: RouteStep, meters: number) {
  const ahead = `${spokenDistance(meters)}, ${lowerFirst(step.instruction)}.`;
  switch (step.kind) {
    case 'left': return `${ahead} Check your mirrors, ease off the gas, and move toward the left lane or the center turn lane when it is clear.`;
    case 'right': return `${ahead} Check your mirrors, ease off the gas, and move toward the right edge of the road when it is clear.`;
    case 'merge-left':
    case 'merge-right': return `${ahead} Match the speed of traffic and look for a gap.`;
    case 'keep-left':
    case 'keep-right': return `${ahead} Check your mirrors and settle into the correct lane early.`;
    case 'roundabout': return `${ahead} Slow down and pick your lane before you reach it.`;
    case 'uturn': return `${ahead} Only turn where a U-turn is legal and you can see far in both directions.`;
    default: return ahead;
  }
}

/** Close call, at signaling distance. */
function signalCue(step: RouteStep) {
  switch (step.kind) {
    case 'left': return 'Signal left now. Check your mirror, then look over your left shoulder for bikes and people in the crosswalk. Yield to oncoming traffic before you turn.';
    case 'right': return 'Signal right now. Check your right mirror, then turn your head to check the right blind spot for bikes. Watch the crosswalk as you turn.';
    case 'merge-left': return 'Signal left now. Check your left mirror, then turn your head to check the left blind spot. Merge smoothly into the gap without slowing down.';
    case 'merge-right': return 'Signal right now. Check your right mirror, then turn your head to check the right blind spot. Merge smoothly into the gap without slowing down.';
    case 'keep-left': return 'If you need to change lanes, signal left, check your mirror and your left blind spot, then move over.';
    case 'keep-right': return 'If you need to change lanes, signal right, check your mirror and your right blind spot, then move over.';
    case 'roundabout': return 'Yield to traffic already in the roundabout. Signal right before your exit.';
    case 'uturn': return 'Signal left now. Check your mirror and your left blind spot, and wait until both directions are clear.';
    default: return null;
  }
}

/**
 * Advances turn-by-turn guidance for one GPS fix. Each maneuver gets an early
 * call to prepare, then a call at signaling distance with mirror and blind-spot
 * checks for that side.
 */
export function advanceGuidance(
  route: PlannedRoute,
  state: GuidanceState,
  latitude: number,
  longitude: number,
): { state: GuidanceState; cue: string | null; nextInstruction: string | null } {
  let { stepIndex, preparedIndex, signaledIndex } = state;
  const distanceTo = (index: number) => {
    const [lon, lat] = route.steps[index].location;
    return distanceMeters(latitude, longitude, lat, lon);
  };
  // Jump past any turn reached, including later ones if the driver skipped a turn.
  for (let index = route.steps.length - 1; index >= stepIndex; index -= 1) {
    if (route.steps[index].kind !== 'arrive' && distanceTo(index) <= STEP_REACHED_METERS) {
      stepIndex = index + 1;
      break;
    }
  }
  const step = route.steps[stepIndex];
  if (!step) return { state: { stepIndex, preparedIndex, signaledIndex }, cue: null, nextInstruction: null };
  const meters = distanceTo(stepIndex);
  let cue: string | null = null;
  if (step.kind === 'arrive') {
    // The loop starts and ends at the same place, so only finish after some progress.
    if (stepIndex > 0 && meters <= STEP_REACHED_METERS * 2 && preparedIndex < stepIndex) {
      cue = step.instruction;
      preparedIndex = stepIndex;
      signaledIndex = stepIndex;
    }
  } else if (meters <= SIGNAL_AHEAD_METERS && signaledIndex < stepIndex) {
    const signal = signalCue(step);
    // If the early call was missed, still say what the maneuver is.
    cue = preparedIndex < stepIndex ? [`${step.instruction}.`, signal].filter(Boolean).join(' ') : signal;
    preparedIndex = stepIndex;
    signaledIndex = stepIndex;
  } else if (meters <= PREPARE_AHEAD_METERS && preparedIndex < stepIndex) {
    cue = prepareCue(step, meters);
    preparedIndex = stepIndex;
  }
  return { state: { stepIndex, preparedIndex, signaledIndex }, cue, nextInstruction: step.instruction };
}

export function describeRoute(route: PlannedRoute) {
  const miles = route.distanceMeters / METERS_PER_MILE;
  const minutes = Math.max(1, Math.round(route.durationSeconds / 60));
  const turns = route.steps.filter((step) => step.kind !== 'arrive' && step.kind !== 'straight').length;
  return `${miles.toFixed(1)} mi · about ${minutes} min · ${turns} turns`;
}
