export type LatLon = [latitude: number, longitude: number];

export type MappedStop = {
  id: string;
  latitude: number;
  longitude: number;
  /** Headings a car travels while approaching the stop along the stop sign's own street. */
  approachBearings: number[];
};

export type MappedSpeedWay = {
  id: string;
  limitMph: number;
  points: LatLon[];
};

export type MapFeatures = {
  stops: MappedStop[];
  speedWays: MappedSpeedWay[];
};

/** About 2.2 km. Requests name only this square, never the exact position or route. */
export const MAP_TILE_DEGREES = 0.02;
const TILE_PADDING_DEGREES = 0.002;
const KILOMETERS_PER_HOUR_TO_MPH = 0.621371;
export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const OVERPASS_USER_AGENT = 'Coastwise/0.1 (driving practice app; https://github.com/qv6zktmm6r-wq/Coastwise)';
export const MAP_ATTRIBUTION = 'Map data © OpenStreetMap contributors';

export const emptyMapFeatures: MapFeatures = { stops: [], speedWays: [] };

export function tileKey(latitude: number, longitude: number) {
  return `${Math.floor(latitude / MAP_TILE_DEGREES)}:${Math.floor(longitude / MAP_TILE_DEGREES)}`;
}

export function tileBounds(key: string) {
  const [row, column] = key.split(':').map(Number);
  return {
    south: row * MAP_TILE_DEGREES - TILE_PADDING_DEGREES,
    west: column * MAP_TILE_DEGREES - TILE_PADDING_DEGREES,
    north: (row + 1) * MAP_TILE_DEGREES + TILE_PADDING_DEGREES,
    east: (column + 1) * MAP_TILE_DEGREES + TILE_PADDING_DEGREES,
  };
}

export function overpassQuery(key: string) {
  const { south, west, north, east } = tileBounds(key);
  const bbox = [south, west, north, east].map((value) => value.toFixed(5)).join(',');
  return [
    '[out:json][timeout:25];',
    `node["highway"="stop"](${bbox})->.stops;`,
    '.stops out body;',
    'way(bn.stops)["highway"];',
    'out geom;',
    `way["highway"]["maxspeed"](${bbox});`,
    'out geom;',
  ].join('\n');
}

/**
 * Returns mph, or null when the limit is not stated with a unit. OpenStreetMap reads a bare
 * number as km/h, but US mappers sometimes mean mph, and guessing wrong would accuse a
 * student of speeding. Coastwise only covers US states, so bare numbers are ignored.
 */
export function parseMaxspeed(value: string | undefined) {
  if (!value) return null;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(mph|km\/h|kmh)\s*$/i.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return match[2].toLowerCase() === 'mph' ? amount : Math.round(amount * KILOMETERS_PER_HOUR_TO_MPH);
}

export function bearingDegrees(from: LatLon, to: LatLon) {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const [latitude1, longitude1] = from.map(toRadians);
  const [latitude2, longitude2] = to.map(toRadians);
  const y = Math.sin(longitude2 - longitude1) * Math.cos(latitude2);
  const x = Math.cos(latitude1) * Math.sin(latitude2)
    - Math.sin(latitude1) * Math.cos(latitude2) * Math.cos(longitude2 - longitude1);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  geometry?: Array<{ lat: number; lon: number } | null>;
};

function wayPoints(element: OverpassElement): LatLon[] | null {
  if (!element.geometry || element.geometry.some((point) => !point)) return null;
  return element.geometry.map((point) => [point!.lat, point!.lon]);
}

export function parseOverpass(json: unknown): MapFeatures {
  const elements = (json as { elements?: OverpassElement[] } | null)?.elements;
  if (!Array.isArray(elements)) return emptyMapFeatures;

  const ways = new Map<number, OverpassElement>();
  for (const element of elements) if (element.type === 'way') ways.set(element.id, element);

  const stops: MappedStop[] = [];
  for (const node of elements) {
    if (node.type !== 'node' || node.tags?.highway !== 'stop') continue;
    if (typeof node.lat !== 'number' || typeof node.lon !== 'number') continue;
    const at: LatLon = [node.lat, node.lon];
    const approachBearings: number[] = [];
    for (const way of ways.values()) {
      const points = wayPoints(way);
      const index = way.nodes?.indexOf(node.id) ?? -1;
      if (!points || index < 0 || points.length !== way.nodes!.length) continue;
      if (index > 0) approachBearings.push(bearingDegrees(points[index - 1], at));
      if (index < points.length - 1) approachBearings.push(bearingDegrees(points[index + 1], at));
    }
    if (approachBearings.length > 0) {
      stops.push({ id: `node/${node.id}`, latitude: node.lat, longitude: node.lon, approachBearings });
    }
  }

  const speedWays: MappedSpeedWay[] = [];
  for (const way of ways.values()) {
    const limitMph = parseMaxspeed(way.tags?.maxspeed);
    const points = wayPoints(way);
    if (limitMph === null || !points || points.length < 2) continue;
    speedWays.push({ id: `way/${way.id}`, limitMph, points });
  }

  return { stops, speedWays };
}

export function mergeMapFeatures(tiles: MapFeatures[]): MapFeatures {
  const stops = new Map<string, MappedStop>();
  const speedWays = new Map<string, MappedSpeedWay>();
  for (const tile of tiles) {
    tile.stops.forEach((stop) => stops.set(stop.id, stop));
    tile.speedWays.forEach((way) => speedWays.set(way.id, way));
  }
  return { stops: [...stops.values()], speedWays: [...speedWays.values()] };
}

/** Downloads one map square. Callers cache by tile key so each square is requested once per drive. */
export async function fetchMapTile(key: string, fetchImpl: typeof fetch = fetch): Promise<MapFeatures> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetchImpl(OVERPASS_ENDPOINT, {
      method: 'POST',
      // overpass-api.de rejects requests without an identifying User-Agent (HTTP 406).
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': OVERPASS_USER_AGENT,
      },
      body: `data=${encodeURIComponent(overpassQuery(key))}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Map data request failed with ${response.status}`);
    return parseOverpass(await response.json());
  } finally {
    clearTimeout(timer);
  }
}
