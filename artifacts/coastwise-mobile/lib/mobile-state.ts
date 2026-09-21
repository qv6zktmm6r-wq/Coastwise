import type { ActiveMobileDrive, MobileDrive, MobileJurisdiction, MobileState } from './coastwise-context';

export const DEFAULT_JURISDICTION = 'US-CA';
export const CURRENT_CALIFORNIA_CONTENT_PACK_VERSION = 'us-ca-2026.09.1';
export const CURRENT_TEXAS_CONTENT_PACK_VERSION = 'us-tx-2026.09.1';
export const CURRENT_FLORIDA_CONTENT_PACK_VERSION = 'us-fl-2026.09.1';

export function isMobileJurisdiction(value: unknown): value is MobileJurisdiction {
  return value === 'US-CA' || value === 'US-TX' || value === 'US-FL';
}

export function getMobileContentPackVersion(jurisdiction: MobileJurisdiction) {
  if (jurisdiction === 'US-TX') return CURRENT_TEXAS_CONTENT_PACK_VERSION;
  if (jurisdiction === 'US-FL') return CURRENT_FLORIDA_CONTENT_PACK_VERSION;
  return CURRENT_CALIFORNIA_CONTENT_PACK_VERSION;
}

/**
 * Adds state introduced after the first mobile release without discarding any
 * locally saved progress. Unknown/malformed storage is treated as empty state
 * by the provider, while this function handles valid legacy objects.
 */
export function hydrateMobileState(value: unknown): MobileState {
  const legacy = value && typeof value === 'object' ? value as Partial<MobileState> : {};
  const jurisdiction = legacy.jurisdiction === 'US-CA'
    ? legacy.jurisdiction
    : DEFAULT_JURISDICTION;
  return {
    ...(legacy as MobileState),
    drives: Array.isArray(legacy.drives) ? legacy.drives : [],
    practiceProgress: legacy.practiceProgress && typeof legacy.practiceProgress === 'object'
      ? legacy.practiceProgress
      : {},
    jurisdiction,
    contentPackVersion: typeof legacy.contentPackVersion === 'string' && legacy.contentPackVersion.length > 0
      ? legacy.contentPackVersion
      : getMobileContentPackVersion(jurisdiction),
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