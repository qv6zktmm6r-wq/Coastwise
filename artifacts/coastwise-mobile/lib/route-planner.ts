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
  /** Uses a ramp or an Interstate, judged from the route's maneuvers and road numbers. */
  usesFreeway: boolean;
};

export type PracticeFocus = 'mixed' | 'left' | 'right' | 'lanes' | 'roundabout';

export const PRACTICE_FOCUS_LABELS: Record<PracticeFocus, string> = {
  mixed: 'Mixed',
  left: 'Left turns',
  right: 'Right turns',
  lanes: 'Merges & lanes',
  roundabout: 'Roundabouts',
};

export type RouteOptions = { avoidFreeways: boolean; focus: PracticeFocus };

export const ROUTE_SERVICE_HOST = 'router.project-osrm.org';
/** Three decimals is roughly 100 m; the routing service never sees the exact spot. */
const ORIGIN_DECIMALS = 3;
/** Finding the way back needs the real street, so rerouting sends about 10 m precision. */
const REJOIN_DECIMALS = 4;
const CANDIDATE_ROUTES = 3;
/** The public OSRM server asks for no more than one request per second. */
const REQUEST_SPACING_MS = 1_100;
const ON_ROUTE_METERS = 35;
const OFF_ROUTE_METERS = 70;
const OFF_ROUTE_SECONDS = 6;
const REQUEST_TIMEOUT_MS = 12_000;
/** First call: what is coming, check mirrors, ease off. */
const PREPARE_AHEAD_METERS = 160;
/** Second call: signal now. Most US handbooks ask for a signal at least 100 feet ahead. */
const SIGNAL_AHEAD_METERS = 55;
const STEP_REACHED_METERS = 30;
/** How many turns ahead a skipped turn can be detected. The earliest match wins, so a corner the loop passes twice is not skipped. */
const SKIP_LOOKAHEAD_STEPS = 3;
const FEET_PER_METER = 3.28084;

type OsrmStep = {
  distance: number;
  name?: string;
  ref?: string;
  maneuver: { location: RouteCoordinate; modifier?: string; type?: string };
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: RouteCoordinate[] };
  legs: Array<{ steps: OsrmStep[] }>;
};

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

function roundCoordinate(value: number, decimals = ORIGIN_DECIMALS) {
  const factor = 10 ** decimals;
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

async function fetchOsrmRoute(url: string, fetchImpl: FetchLike): Promise<OsrmRoute> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`Route service returned ${response.status}`);
      const data = await response.json() as { code?: string; routes?: OsrmRoute[] };
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route) throw new Error('No driving route was found');
      return route;
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Route service unavailable');
}

function routeUrl(points: RouteCoordinate[], extra = '') {
  const coordinates = points.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`).join(';');
  return `https://${ROUTE_SERVICE_HOST}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true${extra}`;
}

function isFreewayStep(step: OsrmStep) {
  const type = step.maneuver.type;
  return type === 'on ramp' || type === 'off ramp' || /^I[\s-]?\d/.test(step.ref ?? '');
}

function toPlannedRoute(route: OsrmRoute, origin: RouteCoordinate): PlannedRoute {
  const allSteps = route.legs.flatMap((leg) => leg.steps);
  return {
    coordinates: route.geometry.coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    origin,
    usesFreeway: allSteps.some(isFreewayStep),
    steps: allSteps
      .filter((step) => step.maneuver.type !== 'depart' && step.maneuver.type !== 'arrive' && step.distance > 12)
      .concat(route.legs.at(-1)?.steps.filter((step) => step.maneuver.type === 'arrive').slice(-1) ?? [])
      .map((step) => {
        const kind = maneuverKind(step);
        return { instruction: instructionFor(step, kind), location: step.maneuver.location, kind };
      }),
  };
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
  const route = await fetchOsrmRoute(routeUrl(loopWaypoints(lat, lon, minutes, variant), '&continue_straight=true'), fetchImpl);
  return toPlannedRoute(route, [lon, lat]);
}

export function focusCount(route: PlannedRoute, focus: PracticeFocus) {
  const kinds: Record<PracticeFocus, ManeuverKind[]> = {
    mixed: ['left', 'right', 'keep-left', 'keep-right', 'merge-left', 'merge-right', 'roundabout'],
    left: ['left'],
    right: ['right'],
    lanes: ['keep-left', 'keep-right', 'merge-left', 'merge-right'],
    roundabout: ['roundabout'],
  };
  return route.steps.filter((step) => kinds[focus].includes(step.kind)).length;
}

/** Freeway-free first when asked, then the most practice of the chosen kind. */
export function chooseRoute(candidates: PlannedRoute[], options: RouteOptions) {
  const score = (route: PlannedRoute) => (options.avoidFreeways && route.usesFreeway ? -1000 : 0) + focusCount(route, options.focus);
  return candidates.reduce((best, route) => (score(route) > score(best) ? route : best));
}

/**
 * Builds a few candidate loops and keeps the best one for the options.
 * `variant` should advance by CANDIDATE_ROUTES between calls.
 */
export async function requestPracticeRoute(
  latitude: number,
  longitude: number,
  minutes: number,
  variant: number,
  options: RouteOptions,
  fetchImpl: FetchLike = fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<PlannedRoute> {
  const candidates: PlannedRoute[] = [];
  let lastError: unknown;
  for (let offset = 0; offset < CANDIDATE_ROUTES; offset += 1) {
    if (offset > 0) await wait(REQUEST_SPACING_MS);
    try {
      const route = await requestPracticeLoop(latitude, longitude, minutes, variant + offset, fetchImpl);
      candidates.push(route);
      const goodEnough = !(options.avoidFreeways && route.usesFreeway) && options.focus === 'mixed';
      if (goodEnough) break;
    } catch (error) {
      lastError = error;
    }
  }
  if (options.avoidFreeways && candidates.length > 0 && candidates.every((route) => route.usesFreeway)) {
    // Smaller loops are less likely to reach a freeway.
    for (const scale of [0.6, 0.35]) {
      await wait(REQUEST_SPACING_MS);
      try {
        const route = await requestPracticeLoop(latitude, longitude, minutes * scale, variant, fetchImpl);
        candidates.push(route);
        if (!route.usesFreeway) break;
      } catch (error) {
        lastError = error;
      }
    }
  }
  if (candidates.length === 0) throw lastError instanceof Error ? lastError : new Error('No nearby driving loop was found');
  return chooseRoute(candidates, options);
}

export const ROUTE_CANDIDATES_PER_REQUEST = CANDIDATE_ROUTES;

function nearestCoordinateIndex(coordinates: RouteCoordinate[], target: RouteCoordinate, fromIndex = 0) {
  let best = fromIndex;
  let bestMeters = Infinity;
  for (let index = fromIndex; index < coordinates.length; index += 1) {
    const [lon, lat] = coordinates[index];
    const meters = distanceMeters(lat, lon, target[1], target[0]);
    if (meters < bestMeters) {
      bestMeters = meters;
      best = index;
    }
  }
  return best;
}

/** A path from the driver back to the next turn they have not reached, followed by the rest of the loop. */
export async function requestRejoinRoute(
  latitude: number,
  longitude: number,
  route: PlannedRoute,
  stepIndex: number,
  fetchImpl: FetchLike = fetch,
): Promise<PlannedRoute> {
  const remaining = route.steps.slice(Math.min(stepIndex, route.steps.length - 1));
  const target = remaining[0]?.location ?? route.origin;
  // The loop starts and ends at the same point, so splice after the last turn passed, not at the start.
  const passed = route.steps[stepIndex - 1];
  const fromIndex = passed ? nearestCoordinateIndex(route.coordinates, passed.location) : 0;
  const here: RouteCoordinate = [roundCoordinate(longitude, REJOIN_DECIMALS), roundCoordinate(latitude, REJOIN_DECIMALS)];
  const back = toPlannedRoute(await fetchOsrmRoute(routeUrl([here, target]), fetchImpl), route.origin);
  return {
    coordinates: [...back.coordinates, ...route.coordinates.slice(nearestCoordinateIndex(route.coordinates, target, fromIndex))],
    distanceMeters: back.distanceMeters,
    durationSeconds: back.durationSeconds,
    origin: route.origin,
    usesFreeway: back.usesFreeway || route.usesFreeway,
    steps: [...back.steps.filter((step) => step.kind !== 'arrive'), ...remaining],
  };
}

/** Meters from a point to the closest part of the route line. */
export function distanceFromRoute(route: PlannedRoute, latitude: number, longitude: number) {
  const metersPerLat = 111_195;
  const metersPerLon = metersPerLat * Math.cos(latitude * Math.PI / 180);
  const toLocal = ([lon, lat]: RouteCoordinate) => [(lon - longitude) * metersPerLon, (lat - latitude) * metersPerLat];
  let best = Infinity;
  for (let index = 1; index < route.coordinates.length; index += 1) {
    const [ax, ay] = toLocal(route.coordinates[index - 1]);
    const [bx, by] = toLocal(route.coordinates[index]);
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

export type AdherenceState = { joined: boolean; offSince: number | null };
export const initialAdherenceState: AdherenceState = { joined: false, offSince: null };

/**
 * Reports leaving the route only after the driver has been on it, and only
 * when they stay well away from it for several seconds, so GPS jitter and the
 * drive to the first street do not trigger a reroute.
 */
export function trackAdherence(state: AdherenceState, metersFromRoute: number, timestamp: number) {
  if (metersFromRoute <= ON_ROUTE_METERS) return { state: { joined: true, offSince: null }, offRoute: false };
  if (!state.joined || metersFromRoute <= OFF_ROUTE_METERS) return { state: { ...state, offSince: null }, offRoute: false };
  const offSince = state.offSince ?? timestamp;
  const offRoute = timestamp - offSince >= OFF_ROUTE_SECONDS * 1000;
  return { state: offRoute ? initialAdherenceState : { joined: true, offSince }, offRoute };
}

export type GuidanceState = {
  stepIndex: number;
  preparedIndex: number;
  signaledIndex: number;
  /** True once the driver has made progress, so reaching the start counts as finishing the loop. */
  progressed: boolean;
};
export const initialGuidanceState: GuidanceState = { stepIndex: 0, preparedIndex: -1, signaledIndex: -1, progressed: false };
/** Guidance for a route that rejoins a loop already in progress. */
export const rejoinGuidanceState: GuidanceState = { ...initialGuidanceState, progressed: true };

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
  /** 'examiner' gives directions only, like a road-test examiner: no reminders. */
  mode: 'coach' | 'examiner' = 'coach',
): { state: GuidanceState; cue: string | null; nextInstruction: string | null; nextStep: RouteStep | null; metersToNext: number | null } {
  let { stepIndex, preparedIndex, signaledIndex, progressed } = state;
  const distanceTo = (index: number) => {
    const [lon, lat] = route.steps[index].location;
    return distanceMeters(latitude, longitude, lat, lon);
  };
  // Jump past any turn reached, including later ones if the driver skipped a turn.
  const lastCandidate = Math.min(route.steps.length - 1, stepIndex + SKIP_LOOKAHEAD_STEPS - 1);
  for (let index = stepIndex; index <= lastCandidate; index += 1) {
    if (route.steps[index].kind !== 'arrive' && distanceTo(index) <= STEP_REACHED_METERS) {
      stepIndex = index + 1;
      progressed = true;
      break;
    }
  }
  const step = route.steps[stepIndex];
  if (!step) return { state: { stepIndex, preparedIndex, signaledIndex, progressed }, cue: null, nextInstruction: null, nextStep: null, metersToNext: null };
  const meters = distanceTo(stepIndex);
  let cue: string | null = null;
  if (step.kind === 'arrive') {
    // The loop starts and ends at the same place, so only finish after some progress.
    if (progressed && meters <= STEP_REACHED_METERS * 2 && preparedIndex < stepIndex) {
      cue = step.instruction;
      preparedIndex = stepIndex;
      signaledIndex = stepIndex;
    }
  } else if (mode === 'examiner') {
    if (meters <= PREPARE_AHEAD_METERS && preparedIndex < stepIndex) {
      cue = meters <= SIGNAL_AHEAD_METERS ? `${step.instruction}.` : `${spokenDistance(meters)}, ${lowerFirst(step.instruction)}.`;
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
  return { state: { stepIndex, preparedIndex, signaledIndex, progressed }, cue, nextInstruction: step.instruction, nextStep: step, metersToNext: meters };
}

const FOCUS_UNITS: Record<PracticeFocus, [string, string]> = {
  mixed: ['turn', 'turns'],
  left: ['left turn', 'left turns'],
  right: ['right turn', 'right turns'],
  lanes: ['merge or lane change', 'merges or lane changes'],
  roundabout: ['roundabout', 'roundabouts'],
};

export function describeRoute(route: PlannedRoute, focus: PracticeFocus = 'mixed') {
  const miles = route.distanceMeters / METERS_PER_MILE;
  const minutes = Math.max(1, Math.round(route.durationSeconds / 60));
  const count = focusCount(route, focus);
  const [one, many] = FOCUS_UNITS[focus];
  return `${miles.toFixed(1)} mi · about ${minutes} min · ${count} ${count === 1 ? one : many}`;
}
