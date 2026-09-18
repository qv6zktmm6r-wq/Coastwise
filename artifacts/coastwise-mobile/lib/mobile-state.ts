import type { ActiveMobileDrive, MobileDrive, MobileState } from './coastwise-context';

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