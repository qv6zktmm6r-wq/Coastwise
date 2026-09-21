import type { ActiveMobileDrive, MobileDrive, MobileJurisdiction, MobileState } from './coastwise-context';

export const DEFAULT_JURISDICTION = 'US-CA';
export const CURRENT_CALIFORNIA_CONTENT_PACK_VERSION = 'us-ca-2026.09.1';

/**
 * Adds state introduced after the first mobile release without discarding any
 * locally saved progress. Unknown/malformed storage is treated as empty state
 * by the provider, while this function handles valid legacy objects.
 */
export function hydrateMobileState(value: unknown): MobileState {
  const legacy = value && typeof value === 'object' ? value as Partial<MobileState> : {};
  return {
    ...(legacy as MobileState),
    drives: Array.isArray(legacy.drives) ? legacy.drives : [],
    jurisdiction: legacy.jurisdiction === DEFAULT_JURISDICTION
      ? legacy.jurisdiction as MobileJurisdiction
      : DEFAULT_JURISDICTION,
    contentPackVersion: typeof legacy.contentPackVersion === 'string' && legacy.contentPackVersion.length > 0
      ? legacy.contentPackVersion
      : CURRENT_CALIFORNIA_CONTENT_PACK_VERSION,
  };
}

export function beginDriveState(current: MobileState, drive: ActiveMobileDrive): MobileState {
  return { ...current, activeDrive: drive };
}

export function updateDriveState(current: MobileState, drive: ActiveMobileDrive): MobileState {
  if (current.activeDrive?.id !== drive.id) return current;
  return { ...current, activeDrive: drive };
}

export function finishDriveState(current: MobileState, drive: MobileDrive): MobileState {
  return {
    ...current,
    activeDrive: undefined,
    drives: current.drives.some((item) => item.id === drive.id)
      ? current.drives.map((item) => item.id === drive.id ? drive : item)
      : [drive, ...current.drives].slice(0, 50),
  };
}

export function saveDriveState(current: MobileState, drive: MobileDrive): MobileState {
  return {
    ...current,
    drives: current.drives.some((item) => item.id === drive.id)
      ? current.drives.map((item) => item.id === drive.id ? drive : item)
      : [drive, ...current.drives].slice(0, 50),
  };
}