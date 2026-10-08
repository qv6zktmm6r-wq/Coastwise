import type { ActiveMobileDrive, MobileDrive, MobileJurisdiction, MobileState } from './coastwise-context';

export const DEFAULT_JURISDICTION = 'US-CA';
export const CURRENT_CALIFORNIA_CONTENT_PACK_VERSION = 'us-ca-2026.09.1';
export const CURRENT_TEXAS_CONTENT_PACK_VERSION = 'us-tx-2026.09.1';
export const CURRENT_FLORIDA_CONTENT_PACK_VERSION = 'us-fl-2026.09.2';
export const CURRENT_NEW_YORK_CONTENT_PACK_VERSION = 'us-ny-2026.09.1';
export const CURRENT_OHIO_CONTENT_PACK_VERSION = 'us-oh-2026.09.1';
export const CURRENT_ILLINOIS_CONTENT_PACK_VERSION = 'us-il-2026.09.1';
export const MOBILE_JURISDICTION_LABELS = {
  'US-CA': 'California', 'US-TX': 'Texas', 'US-FL': 'Florida',
  'US-NY': 'New York', 'US-OH': 'Ohio', 'US-IL': 'Illinois',
} as const;

export function isMobileJurisdiction(value: unknown): value is MobileJurisdiction {
  return value === 'US-CA' || value === 'US-TX' || value === 'US-FL' || value === 'US-NY' || value === 'US-OH' || value === 'US-IL';
}
export function isApprovedMobileJurisdiction(value: unknown): value is MobileJurisdiction {
  return value === 'US-CA' || value === 'US-TX' || value === 'US-FL' || value === 'US-NY' || value === 'US-OH' || value === 'US-IL';
}

export function getMobileContentPackVersion(jurisdiction: MobileJurisdiction) {
  if (jurisdiction === 'US-TX') return CURRENT_TEXAS_CONTENT_PACK_VERSION;
  if (jurisdiction === 'US-FL') return CURRENT_FLORIDA_CONTENT_PACK_VERSION;
  if (jurisdiction === 'US-NY') return CURRENT_NEW_YORK_CONTENT_PACK_VERSION;
  if (jurisdiction === 'US-OH') return CURRENT_OHIO_CONTENT_PACK_VERSION;
  if (jurisdiction === 'US-IL') return CURRENT_ILLINOIS_CONTENT_PACK_VERSION;
  return CURRENT_CALIFORNIA_CONTENT_PACK_VERSION;
}

/**
 * Adds state introduced after the first mobile release without discarding any
 * locally saved progress. Unknown/malformed storage is treated as empty state
 * by the provider, while this function handles valid legacy objects.
 */
export function hydrateMobileState(value: unknown): MobileState {
  const legacy = value && typeof value === 'object' ? value as Partial<MobileState> : {};
  const jurisdiction = isApprovedMobileJurisdiction(legacy.jurisdiction)
    ? legacy.jurisdiction
    : DEFAULT_JURISDICTION;
  return {
    ...(legacy as MobileState),
    drives: Array.isArray(legacy.drives) ? legacy.drives : [],
    practiceProgress: legacy.practiceProgress && typeof legacy.practiceProgress === 'object'
      ? legacy.practiceProgress
      : {},
    jurisdiction,
    contentPackVersion: legacy.contentPackVersion === getMobileContentPackVersion(jurisdiction)
      ? getMobileContentPackVersion(jurisdiction)
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

/** Drives that keep their full event list; older drives keep only their log totals. */
export const DETAILED_DRIVES = 50;

/**
 * Every drive stays in the permit log. Only the newest drives keep detailed
 * events, which skill trends read; older ones drop them to keep storage small.
 */
export function compactDrives(drives: MobileDrive[]): MobileDrive[] {
  const time = (drive: MobileDrive) => new Date(drive.date).getTime() || 0;
  const sorted = [...drives].sort((a, b) => time(b) - time(a));
  return sorted.map((drive, index) => {
    if (index < DETAILED_DRIVES || (drive.events === undefined && drive.turnScores === undefined)) return drive;
    const { events: _events, turnScores: _turnScores, ...summary } = drive;
    return summary;
  });
}

function upsertDrive(drives: MobileDrive[], drive: MobileDrive) {
  return compactDrives(drives.some((item) => item.id === drive.id)
    ? drives.map((item) => item.id === drive.id ? drive : item)
    : [drive, ...drives]);
}

export function finishDriveState(current: MobileState, drive: MobileDrive): MobileState {
  return { ...current, activeDrive: undefined, drives: upsertDrive(current.drives, drive) };
}

/** Updates a drive already in the log. A drive deleted meanwhile stays deleted. */
export function saveDriveState(current: MobileState, drive: MobileDrive): MobileState {
  if (!current.drives.some((item) => item.id === drive.id)) return current;
  return { ...current, drives: upsertDrive(current.drives, drive) };
}

export function addDriveState(current: MobileState, drive: MobileDrive): MobileState {
  return { ...current, drives: upsertDrive(current.drives, drive) };
}

export function deleteDriveState(current: MobileState, driveId: string): MobileState {
  return { ...current, drives: current.drives.filter((drive) => drive.id !== driveId) };
}