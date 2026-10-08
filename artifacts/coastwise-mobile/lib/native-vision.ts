import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import type { ComponentType } from 'react';
import type { CoachCamerasProps } from '@/components/CoachCameras';

let cached: ComponentType<CoachCamerasProps> | null | undefined;

/**
 * Camera coaching needs native modules that only exist in a Coastwise
 * development or store build. Expo Go and web get null and keep GPS coaching.
 */
export function loadCoachCameras(): ComponentType<CoachCamerasProps> | null {
  if (cached !== undefined) return cached;
  if (Platform.OS !== 'ios' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    cached = null;
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = (require('@/components/CoachCameras') as typeof import('@/components/CoachCameras')).CoachCameras;
  } catch {
    cached = null;
  }
  return cached;
}
