export type RouteCoordinate = [number, number];

export type RouteStep = {
  instruction: string;
  modifier: string;
  name: string;
  distance: number;
  location: RouteCoordinate;
};

export type PlannedRoute = {
  coordinates: RouteCoordinate[];
  steps: RouteStep[];
  distanceMeters: number;
  durationSeconds: number;
  origin: RouteCoordinate;
};

const DRIVE_RECORDINGS_DATABASE = 'coastwise-drive-recordings';
const DRIVE_RECORDINGS_STORE = 'recordings';

function openDriveRecordingsDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DRIVE_RECORDINGS_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(DRIVE_RECORDINGS_STORE)) {
        request.result.createObjectStore(DRIVE_RECORDINGS_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local drive storage'));
  });
}

export async function saveDriveRecording(id: string, recording: Blob): Promise<void> {
  const database = await openDriveRecordingsDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DRIVE_RECORDINGS_STORE, 'readwrite');
    transaction.objectStore(DRIVE_RECORDINGS_STORE).put(recording, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not save the drive recording'));
  });
  database.close();
}

export async function loadDriveRecording(id: string): Promise<Blob | null> {
  const database = await openDriveRecordingsDatabase();
  const recording = await new Promise<Blob | null>((resolve, reject) => {
    const request = database.transaction(DRIVE_RECORDINGS_STORE, 'readonly').objectStore(DRIVE_RECORDINGS_STORE).get(id);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error('Could not load the drive recording'));
  });
  database.close();
  return recording;
}

export async function deleteDriveRecording(id: string): Promise<void> {
  const database = await openDriveRecordingsDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DRIVE_RECORDINGS_STORE, 'readwrite');
    transaction.objectStore(DRIVE_RECORDINGS_STORE).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not delete the drive recording'));
  });
  database.close();
}

export async function clearDriveRecordings(): Promise<void> {
  const database = await openDriveRecordingsDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DRIVE_RECORDINGS_STORE, 'readwrite');
    transaction.objectStore(DRIVE_RECORDINGS_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Could not clear saved drive recordings'));
  });
  database.close();
}

type OsrmStep = {
  distance: number;
  name?: string;
  maneuver: {
    location: [number, number];
    modifier?: string;
    type?: string;
  };
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: Array<{ steps: OsrmStep[] }>;
};

type OsrmResponse = { code: string; routes?: OsrmRoute[] };

async function fetchOsrmRoute(url: string, unavailableMessage: string): Promise<OsrmRoute> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        continue;
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
    if (!response.ok) {
      const error = new Error(`Route service returned ${response.status}`);
      const transient = response.status === 408 || response.status === 429 || response.status >= 500;
      if (transient && attempt === 0) {
        lastError = error;
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        continue;
      }
      throw error;
    }
    let data: OsrmResponse;
    try {
      data = await response.json() as OsrmResponse;
    } catch {
      throw new Error('Route service returned an invalid response');
    }
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) throw new Error(unavailableMessage);
    return route;
  }
  throw lastError instanceof Error ? lastError : new Error(unavailableMessage);
}

function instructionFor(step: OsrmStep) {
  const modifier = step.maneuver.modifier ?? 'straight';
  const road = step.name ? ` onto ${step.name}` : '';
  if (modifier.includes('left')) return `Turn left${road}`;
  if (modifier.includes('right')) return `Turn right${road}`;
  if (step.maneuver.type === 'arrive') return 'Return to the starting area';
  return `Continue straight${road}`;
}

export async function requestPracticeLoop(latitude: number, longitude: number, minutes: number): Promise<PlannedRoute> {
  const distanceMiles = Math.max(0.7, minutes * 0.18);
  const radiusMiles = Math.min(2.2, Math.max(0.25, distanceMiles / 4));
  const latOffset = radiusMiles / 69;
  const lonOffset = radiusMiles / (69 * Math.max(0.35, Math.cos(latitude * Math.PI / 180)));
  const waypoints: RouteCoordinate[] = [
    [longitude, latitude],
    [longitude + lonOffset, latitude + latOffset * 0.28],
    [longitude + lonOffset * 0.18, latitude + latOffset],
    [longitude - lonOffset, latitude + latOffset * 0.15],
    [longitude, latitude],
  ];
  const coordinates = waypoints.map(([lon, lat]) => `${lon},${lat}`).join(';');
  const route = await fetchOsrmRoute(
    `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true&continue_straight=true`,
    'No nearby driving loop was found',
  );
  return {
    coordinates: route.geometry.coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    origin: [longitude, latitude],
    steps: route.legs.flatMap((leg) => leg.steps)
      .filter((step) => step.maneuver.type !== 'depart' && (step.distance > 12 || step.maneuver.type === 'arrive'))
      .map((step) => ({
        instruction: instructionFor(step),
        modifier: step.maneuver.modifier ?? 'straight',
        name: step.name ?? '',
        distance: step.distance,
        location: step.maneuver.location,
      })),
  };
}

export async function requestReturnRoute(latitude: number, longitude: number, destination: RouteCoordinate): Promise<PlannedRoute> {
  const route = await fetchOsrmRoute(
    `https://router.project-osrm.org/route/v1/driving/${longitude},${latitude};${destination[0]},${destination[1]}?overview=full&geometries=geojson&steps=true`,
    'No return route was found',
  );
  return {
    coordinates: route.geometry.coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    origin: destination,
    steps: route.legs.flatMap((leg) => leg.steps)
      .filter((step) => step.maneuver.type !== 'depart' && (step.distance > 12 || step.maneuver.type === 'arrive'))
      .map((step) => ({
        instruction: instructionFor(step),
        modifier: step.maneuver.modifier ?? 'straight',
        name: step.name ?? '',
        distance: step.distance,
        location: step.maneuver.location,
      })),
  };
}