import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCreateDriveDebrief } from '@workspace/api-client-react';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraView as CameraViewType } from 'expo-camera';
import { setAudioModeAsync } from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, Text, View, AccessibilityInfo } from 'react-native';
import { ActionButton, Body, Card, Eyebrow, Screen, Title, usePalette } from '@/components/ui';
import { useCoastwise, type ActiveMobileDrive, type MobileDrive } from '@/lib/coastwise-context';
import {
  deleteAllLocalRecordings,
  deleteLocalRecording,
  cleanupLocalRecordings,
  finalizeRecording,
  formatStorageSize,
  listLocalRecordings,
  STORAGE_WARNING_BYTES,
  type LocalRecording,
} from '@/lib/recordings';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { getMobileWeakTopics } from '@/lib/practice-content';
import {
  attachRecording,
  DriveLifecycleCoordinator,
  shouldRequestMicrophonePermission,
} from '@/lib/drive-lifecycle';
import { addDistanceFix, MAX_FIX_ACCURACY_METERS, METERS_PER_MILE, type DistanceFix } from '@/lib/drive-distance';
import { evaluateSignals, initialSignalState, type SignalState } from '@/lib/drive-signals';
import {
  chooseSpokenCue,
  coachTitle,
  describeEvent,
  initialCoachVoiceState,
  recordEvent,
  summarizeForDebrief,
  type CoachableEvent,
  type CoachVoiceState,
} from '@/lib/drive-coach';
import { evaluateManeuvers, initialManeuverState, type ManeuverState } from '@/lib/maneuvers';
import { isAfterDark } from '@/lib/sun';
import { emptyMapFeatures, fetchMapTile, MAP_ATTRIBUTION, mergeMapFeatures, tileKey, type MapFeatures } from '@/lib/map-data';
import { evaluateVision, initialVisionState, type Detection, type VisionState } from '@/lib/road-vision';
import { evaluateAttention, initialAttentionState, stopScanVerdict, type AttentionState } from '@/lib/driver-attention';
import { loadCoachCameras } from '@/lib/native-vision';
import { chooseCoachVoice, type ChosenVoice } from '@/lib/coach-voice';
import type { CoachCameraStatus } from '@/components/CoachCameras';

const DRIVE_SKILLS = ['turns', 'intersections'];
const KEEP_AWAKE_TAG = 'coastwise-active-drive';
const MAP_COACHING_KEY = 'coastwise-map-coaching';
const CAMERA_COACHING_KEY = 'coastwise-camera-coaching';
const DRIVER_ATTENTION_KEY = 'coastwise-driver-attention';
const MPH_PER_METER_PER_SECOND = 2.236936;
/** A face reading older than this means the driver camera no longer sees a face. */
const FACE_STALE_MS = 600;
const ATTENTION_SAMPLE_MS = 500;
const STOP_KINDS = new Set(['stop-sign-complete', 'rolling-stop', 'camera-stop-complete', 'camera-rolling-stop']);
function explainPermission(title: string, permission: { granted: boolean; canAskAgain?: boolean } | null | undefined) {
  if (permission?.granted) return;
  const canAskAgain = permission?.canAskAgain !== false;
  Alert.alert(
    `${title} permission needed`,
    canAskAgain
      ? `Allow ${title.toLowerCase()} access to use this optional drive feature.`
      : `Enable ${title.toLowerCase()} access in ${Platform.OS === 'android' ? 'Android' : 'device'} Settings to use this optional drive feature.`,
    canAskAgain
      ? [{ text: 'OK' }]
      : [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings().catch(() => undefined) },
      ],
  );
}

function recordingDate(recording: LocalRecording) {
  return recording.modifiedAt
    ? new Date(recording.modifiedAt * 1000).toLocaleDateString()
    : 'Saved recording';
}

export default function DriveScreen() {
  const palette = usePalette();
  const {
    drives,
    activeDrive,
    hydrated,
    recordingRetentionDays,
    setRecordingRetention,
    beginActiveDrive,
    updateActiveDrive,
    finishActiveDrive,
    discardActiveDrive,
    saveDrive,
    forgetRecording,
    forgetAllRecordings,
    jurisdiction,
    contentPackVersion,
    practiceProgress,
  } = useCoastwise();
  const cameraRef = useRef<CameraViewType | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const distanceAnchor = useRef<DistanceFix | null>(null);
  const signalState = useRef<SignalState>(initialSignalState);
  const coachVoiceState = useRef<CoachVoiceState>(initialCoachVoiceState);
  const voiceOnRef = useRef(true);
  const maneuverState = useRef<ManeuverState>(initialManeuverState);
  /** Last known position, kept in memory only, to tell day from night. */
  const sunPlace = useRef<{ latitude: number; longitude: number } | null>(null);
  const nightSecondsRef = useRef(0);
  const mapCoachingRef = useRef(false);
  const mapTiles = useRef(new Map<string, MapFeatures>());
  const mapTilesRequested = useRef(new Set<string>());
  const mapFeatures = useRef<MapFeatures>(emptyMapFeatures);
  const CoachCameras = useMemo(() => loadCoachCameras(), []);
  const visionState = useRef<VisionState>(initialVisionState);
  const attentionState = useRef<AttentionState>(initialAttentionState);
  const driverAttentionLiveRef = useRef(false);
  const latestSpeed = useRef<number | null>(null);
  const latestHeading = useRef<number | null>(null);
  const latestFace = useRef<{ yawDegrees: number | null; at: number } | null>(null);
  const driveRef = useRef<MobileDrive | null>(null);
  const elapsedRef = useRef(0);
  const lifecycleRef = useRef(new DriveLifecycleCoordinator());
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [locationReady, setLocationReady] = useState(false);
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [speedMph, setSpeedMph] = useState<number | null>(null);
  const [lastCue, setLastCue] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [mapCoaching, setMapCoaching] = useState(false);
  const [mappedLimitMph, setMappedLimitMph] = useState<number | null>(null);
  const [mapStatus, setMapStatus] = useState<'off' | 'loading' | 'ready' | 'unavailable'>('off');
  const [cameraCoaching, setCameraCoaching] = useState(false);
  const [driverAttention, setDriverAttention] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CoachCameraStatus | null>(null);
  const [coachVoice, setCoachVoice] = useState<ChosenVoice | null>(null);
  const coachVoiceRef = useRef<ChosenVoice | null>(null);
  const [active, setActive] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recoveryActionPending, setRecoveryActionPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingPrepared, setRecordingPrepared] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [drive, setDrive] = useState<MobileDrive | null>(null);
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [storageLoading, setStorageLoading] = useState(true);
  const [debriefError, setDebriefError] = useState(false);
  const createDebrief = useCreateDriveDebrief();

  const refreshRecordings = useCallback(async () => {
    setStorageLoading(true);
    try {
      if (recordingRetentionDays) {
        const deletedUris = await cleanupLocalRecordings(recordingRetentionDays);
        if (deletedUris.length > 0) {
          deletedUris.forEach(forgetRecording);
        }
      }
      setRecordings(await listLocalRecordings());
    } finally {
      setStorageLoading(false);
    }
  }, [recordingRetentionDays, forgetRecording]);

  useEffect(() => {
    void refreshRecordings();
  }, [refreshRecordings]);

  useEffect(() => {
    driveRef.current = drive;
  }, [drive]);

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    if (!hydrated || !activeDrive || active || driveRef.current) return;
    driveRef.current = activeDrive;
    elapsedRef.current = activeDrive.elapsedSeconds;
    setDrive(activeDrive);
    setElapsed(activeDrive.elapsedSeconds);
    setRecordingPrepared(activeDrive.recordingRequested ?? false);
    setRecoveryPending(true);
  }, [active, activeDrive, hydrated]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const nextElapsed = elapsedRef.current + 1;
      elapsedRef.current = nextElapsed;
      setElapsed(nextElapsed);
      const place = sunPlace.current;
      if (place && isAfterDark(Date.now(), place.latitude, place.longitude)) nightSecondsRef.current += 1;
      const current = driveRef.current;
      if (current && nextElapsed % 5 === 0) {
        const updated: ActiveMobileDrive = {
          ...current,
          startedAt: activeDrive?.startedAt ?? new Date().toISOString(),
          elapsedSeconds: nextElapsed,
          // Until GPS has a position, keep the start-time guess instead of logging zero night time.
          nightSeconds: sunPlace.current ? nightSecondsRef.current : (current as ActiveMobileDrive).nightSeconds,
        };
        driveRef.current = updated;
        setDrive(updated);
        updateActiveDrive(updated);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [active, activeDrive?.startedAt, updateActiveDrive]);

  const stopNativeSession = useCallback(() => {
    cameraRef.current?.stopRecording();
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    distanceAnchor.current = null;
    signalState.current = initialSignalState;
    maneuverState.current = initialManeuverState;
    visionState.current = initialVisionState;
    attentionState.current = initialAttentionState;
    latestSpeed.current = null;
    latestHeading.current = null;
    latestFace.current = null;
    void Speech.stop();
    setLocationReady(false);
    setGpsAccuracyMeters(null);
    setSpeedMph(null);
    setMappedLimitMph(null);
    setCameraStatus(null);
  }, []);

  const speakCue = useCallback((text: string) => {
    setLastCue(text);
    if (!voiceOnRef.current) return;
    void Speech.stop();
    Speech.speak(text, { language: 'en-US', voice: coachVoiceRef.current?.identifier, rate: 0.98 });
  }, []);

  useEffect(() => {
    const refreshVoice = () => {
      void Speech.getAvailableVoicesAsync().then((voices) => {
        const chosen = chooseCoachVoice(voices);
        coachVoiceRef.current = chosen;
        setCoachVoice(chosen);
      }).catch(() => undefined);
    };
    refreshVoice();
    // Re-check after the user downloads a better voice in Settings.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshVoice();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    void AsyncStorage.multiGet([MAP_COACHING_KEY, CAMERA_COACHING_KEY, DRIVER_ATTENTION_KEY]).then((values) => {
      const saved = Object.fromEntries(values);
      mapCoachingRef.current = saved[MAP_COACHING_KEY] === 'on';
      setMapCoaching(mapCoachingRef.current);
      setCameraCoaching(saved[CAMERA_COACHING_KEY] === 'on');
      setDriverAttention(saved[DRIVER_ATTENTION_KEY] === 'on');
    }).catch(() => undefined);
  }, []);

  const toggleCameraCoaching = () => {
    const next = !cameraCoaching;
    if (next && recordingPrepared) {
      Alert.alert('Turn off local video first', 'Camera coaching and local video both need the back camera. Choose one for this drive.');
      return;
    }
    setCameraCoaching(next);
    void AsyncStorage.setItem(CAMERA_COACHING_KEY, next ? 'on' : 'off').catch(() => undefined);
  };

  const toggleDriverAttention = () => {
    const save = (next: boolean) => {
      setDriverAttention(next);
      void AsyncStorage.setItem(DRIVER_ATTENTION_KEY, next ? 'on' : 'off').catch(() => undefined);
    };
    if (driverAttention) {
      save(false);
      return;
    }
    if (recordingPrepared) {
      Alert.alert('Turn off local video first', 'The driver camera cannot run while local video is recording.');
      return;
    }
    Alert.alert(
      'Watch where the driver looks?',
      'The front camera checks head direction for head checks before turns, scanning at stop signs, and long looks away. '
        + 'Only head angles are used, on this phone. No image or video from this camera is saved or sent. '
        + 'The student and the supervising adult should both agree. You can turn this off at any time.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'We both agree', onPress: () => save(true) },
      ],
    );
  };

  const toggleMapCoaching = () => {
    const next = !mapCoachingRef.current;
    mapCoachingRef.current = next;
    setMapCoaching(next);
    void AsyncStorage.setItem(MAP_COACHING_KEY, next ? 'on' : 'off').catch(() => undefined);
  };

  const ensureMapTile = (latitude: number, longitude: number) => {
    const key = tileKey(latitude, longitude);
    if (mapTilesRequested.current.has(key)) return;
    mapTilesRequested.current.add(key);
    setMapStatus((status) => (status === 'ready' ? status : 'loading'));
    void fetchMapTile(key).then((tile) => {
      mapTiles.current.set(key, tile);
      mapFeatures.current = mergeMapFeatures([...mapTiles.current.values()]);
      setMapStatus('ready');
    }).catch(() => {
      // Allow a retry the next time the car is in this square.
      mapTilesRequested.current.delete(key);
      setMapStatus((status) => (status === 'ready' ? status : 'unavailable'));
    });
  };

  /** Records, speaks, and saves measured events from GPS, map data, or the cameras. */
  const applyEvents = useCallback((detected: CoachableEvent[], addedMeters = 0, sessionId?: string) => {
    if (addedMeters <= 0 && detected.length === 0) return;
    const current = driveRef.current;
    if (!current || (sessionId !== undefined && current.id !== sessionId)) return;
    const withScans: CoachableEvent[] = [];
    for (const event of detected) {
      withScans.push(event);
      if (!driverAttentionLiveRef.current || !STOP_KINDS.has(event.kind)) continue;
      const verdict = stopScanVerdict(attentionState.current, event.at);
      if (verdict) {
        withScans.push({
          kind: verdict.scanned ? 'scanned-at-stop' : 'no-scan-at-stop',
          at: event.at,
          speedMph: event.speedMph,
          magnitude: verdict.headTurns,
        });
      }
    }
    let events = current.events;
    for (const event of withScans) {
      events = recordEvent(events, event, elapsedRef.current);
      const cue = chooseSpokenCue(coachVoiceState.current, event);
      coachVoiceState.current = cue.state;
      if (cue.spoken) speakCue(cue.spoken);
    }
    const updated: ActiveMobileDrive = {
      ...(current as ActiveMobileDrive),
      distanceMiles: current.distanceMiles + addedMeters / METERS_PER_MILE,
      events,
      startedAt: (current as ActiveMobileDrive).startedAt ?? activeDrive?.startedAt ?? new Date().toISOString(),
      elapsedSeconds: elapsedRef.current,
    };
    driveRef.current = updated;
    setDrive(updated);
    updateActiveDrive(updated);
  }, [activeDrive?.startedAt, speakCue, updateActiveDrive]);

  const handleDetections = useCallback((detections: Detection[]) => {
    const result = evaluateVision(visionState.current, {
      timestamp: Date.now(),
      detections,
      speedMetersPerSecond: latestSpeed.current,
    });
    visionState.current = result.state;
    applyEvents(result.events);
  }, [applyEvents]);

  const handleFace = useCallback((yawDegrees: number | null) => {
    latestFace.current = { yawDegrees, at: Date.now() };
  }, []);

  const handleCameraStatus = useCallback((status: CoachCameraStatus) => {
    setCameraStatus(status);
    const current = driveRef.current;
    if (!current || (status !== 'running' && status !== 'road-only')) {
      if (status === 'camera-unavailable' || status === 'model-unavailable') driverAttentionLiveRef.current = false;
      return;
    }
    driverAttentionLiveRef.current = driverAttention && status === 'running';
    const updated = {
      ...current,
      cameraCoaching: current.cameraCoaching || cameraCoaching,
      driverAttention: current.driverAttention || driverAttentionLiveRef.current,
    };
    driveRef.current = updated;
    setDrive(updated);
  }, [cameraCoaching, driverAttention]);

  const toggleVoice = () => {
    const next = !voiceOnRef.current;
    voiceOnRef.current = next;
    setVoiceOn(next);
    if (!next) void Speech.stop();
  };

  useEffect(() => {
    if (!active) return;
    // iOS auto-lock backgrounds the app, which pauses the drive and stops location.
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    // Without this, the iPhone silent switch mutes every spoken cue.
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
      allowsRecording: recordingPrepared && Boolean(microphonePermission?.granted),
      shouldPlayInBackground: false,
    }).catch(() => undefined);
  }, [active, recordingPrepared, microphonePermission?.granted]);

  const pauseForInterruption = useCallback(() => {
    const current = driveRef.current;
    if (!current) return;
    const paused = lifecycleRef.current.pause(
      {
        ...current,
        startedAt: activeDrive?.startedAt ?? new Date().toISOString(),
        elapsedSeconds: elapsedRef.current,
      },
      elapsedRef.current,
      stopNativeSession,
      (nextDrive) => {
        driveRef.current = nextDrive;
        setDrive(nextDrive);
        updateActiveDrive(nextDrive);
      },
    );
    if (!paused) return;
    setActive(false);
    setRecoveryPending(true);
    AccessibilityInfo.announceForAccessibility("Drive paused due to app interruption. Please resume when ready.");
  }, [activeDrive?.startedAt, stopNativeSession, updateActiveDrive]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (active && state !== 'active') pauseForInterruption();
    });
    return () => subscription.remove();
  }, [active, pauseForInterruption]);

  useEffect(() => () => stopNativeSession(), [stopNativeSession]);

  const camerasOn = active && Boolean(CoachCameras) && (cameraCoaching || driverAttention) && !recordingPrepared;

  useEffect(() => {
    if (!camerasOn || !driverAttention) return;
    const timer = setInterval(() => {
      if (!driverAttentionLiveRef.current) return;
      const now = Date.now();
      const face = latestFace.current;
      const visible = face !== null && now - face.at <= FACE_STALE_MS;
      const result = evaluateAttention(attentionState.current, {
        timestamp: now,
        speedMetersPerSecond: latestSpeed.current,
        headingDegrees: latestHeading.current,
        face: { visible, yawDegrees: visible ? face.yawDegrees : null },
      });
      attentionState.current = result.state;
      applyEvents(result.events);
    }, ATTENTION_SAMPLE_MS);
    return () => {
      clearInterval(timer);
      driverAttentionLiveRef.current = false;
    };
  }, [camerasOn, driverAttention, applyEvents]);

  const beginLocationTracking = async (session: ActiveMobileDrive) => {
    const location = await Location.requestForegroundPermissionsAsync();
    if (location.status !== Location.PermissionStatus.GRANTED) {
      explainPermission('Location', location);
      return false;
    }
    const previousDrive = driveRef.current;
    const previousElapsed = elapsedRef.current;
    try {
      distanceAnchor.current = null;
      nightSecondsRef.current = session.nightSeconds ?? 0;
      if (session.nightSeconds === undefined) sunPlace.current = null;
      driveRef.current = session;
      elapsedRef.current = session.elapsedSeconds;
      setDrive(session);
      setElapsed(session.elapsedSeconds);
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 1000 },
        ({ coords, timestamp }) => {
          setGpsAccuracyMeters(coords.accuracy ?? null);
          sunPlace.current = { latitude: coords.latitude, longitude: coords.longitude };
          const step = addDistanceFix(distanceAnchor.current, {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracyMeters: coords.accuracy ?? null,
            timestamp,
          });
          distanceAnchor.current = step.anchor;
          const measured = evaluateSignals(signalState.current, {
            speedMetersPerSecond: coords.speed,
            headingDegrees: coords.heading,
            accuracyMeters: coords.accuracy,
            timestamp,
          });
          signalState.current = measured.state;
          setSpeedMph(measured.speedMph);
          latestSpeed.current = measured.speedMph === null ? null : measured.speedMph / MPH_PER_METER_PER_SECOND;
          latestHeading.current = coords.heading !== null && coords.heading >= 0 && (coords.speed ?? 0) > 1 ? coords.heading : null;
          const detected: CoachableEvent[] = [...measured.signals];
          if (mapCoachingRef.current) {
            ensureMapTile(coords.latitude, coords.longitude);
            const graded = evaluateManeuvers(maneuverState.current, mapFeatures.current, {
              latitude: coords.latitude,
              longitude: coords.longitude,
              speedMetersPerSecond: coords.speed,
              headingDegrees: coords.heading,
              accuracyMeters: coords.accuracy,
              timestamp,
            });
            maneuverState.current = graded.state;
            setMappedLimitMph(graded.state.currentLimitMph);
            detected.push(...graded.events);
          }
          applyEvents(detected, step.meters, session.id);
        },
      );
      setLocationReady(true);
      AccessibilityInfo.announceForAccessibility("GPS location ready.");
      setRecoveryPending(false);
      setActive(true);
      return true;
    } catch {
      Alert.alert('Location unavailable', 'Coastwise could not start foreground location. Your saved progress is unchanged.');
      stopNativeSession();
      driveRef.current = previousDrive;
      elapsedRef.current = previousElapsed;
      setDrive(previousDrive);
      setElapsed(previousElapsed);
      return false;
    }
  };

  const startDrive = async () => {
    const session: ActiveMobileDrive = {
      id: `drive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
      durationMinutes: 1,
      distanceMiles: 0,
      night: new Date().getHours() < 7 || new Date().getHours() >= 19,
      skills: DRIVE_SKILLS,
      startedAt: new Date().toISOString(),
      elapsedSeconds: 0,
      recordingRequested: recordingPrepared,
    };
    if (await beginLocationTracking(session)) {
      lifecycleRef.current.beginDrive();
      beginActiveDrive(session);
      coachVoiceState.current = initialCoachVoiceState;
      setLastCue(null);
      speakCue('Coached drive started. I will speak up when GPS measures something worth coaching.');
    }
  };

  const resumeDrive = async () => {
    await lifecycleRef.current.resume(
      () => driveRef.current as ActiveMobileDrive | null,
      beginLocationTracking,
      setRecoveryActionPending,
    );
  };

  const startRecording = async () => {
    if (!cameraPermission?.granted) return;
    const camera = cameraRef.current;
    if (!camera) return;
    const recordingDriveId = driveRef.current?.id;
    if (!recordingDriveId) return;
    setRecording(true);
    AccessibilityInfo.announceForAccessibility("Recording started.");
    let cleanupFailed = false;
    const task = (async () => {
      const result = await camera.recordAsync({ maxDuration: 3600 });
      const metadata = await finalizeRecording(result, () => {
        cleanupFailed = true;
      });
      if (!metadata) throw new Error('Camera did not return a saved recording.');
      const updated = attachRecording(driveRef.current, recordingDriveId, {
        uri: metadata.uri,
        sizeBytes: metadata.sizeBytes,
      });
      if (updated) {
        driveRef.current = updated;
        setDrive(updated);
        if (active) {
          updateActiveDrive({
            ...updated,
            startedAt: activeDrive?.startedAt ?? new Date().toISOString(),
            elapsedSeconds: elapsedRef.current,
          });
        } else {
          saveDrive(updated);
        }
      }
      await refreshRecordings();
    })().catch(() => {
      Alert.alert(
        'Recording unavailable',
        cleanupFailed
          ? 'Coastwise could not save this recording. Your drive summary is still safe. The unfinished video could not be removed, so review Local recordings when parked.'
          : 'Coastwise could not save this recording. Your drive summary is still safe.',
      );
    }).finally(() => {
      setRecording(false);
    });
    lifecycleRef.current.beginRecording(task);
    await task;
  };

  useEffect(() => {
    if (active && recordingPrepared && !recording && cameraRef.current) {
      void startRecording();
    }
  }, [active, recordingPrepared]);

  const prepareRecording = async () => {
    if (active) return;
    if (recordingPrepared) {
      setRecordingPrepared(false);
      AccessibilityInfo.announceForAccessibility('Local recording disabled for the next drive.');
      return;
    }
    if (CoachCameras && (cameraCoaching || driverAttention)) {
      Alert.alert('Turn off camera coaching first', 'Local video and camera coaching both need the camera. Choose one for this drive.');
      return;
    }
    const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    const microphone = shouldRequestMicrophonePermission(active, microphonePermission)
      ? await requestMicrophonePermission()
      : microphonePermission ?? { granted: false };
    if (!camera.granted) {
      explainPermission('Camera', camera);
      return;
    }
    setRecordingPrepared(true);
    AccessibilityInfo.announceForAccessibility(
      microphone.granted
        ? 'Local video and audio recording prepared for the next drive.'
        : 'Local video recording prepared without audio for the next drive.',
    );
  };

  const stopDrive = async () => {
    await lifecycleRef.current.end(
      () => driveRef.current,
      () => elapsedRef.current,
      stopNativeSession,
      (finished) => {
        driveRef.current = finished;
        setDrive(finished);
        finishActiveDrive(finished);
        setActive(false);
        setRecordingPrepared(false);
        setRecoveryPending(false);
        AccessibilityInfo.announceForAccessibility("Drive finished.");
      },
      setRecoveryActionPending,
    );
  };

  const discardRecoveredDrive = () => {
    Alert.alert('Discard unfinished drive?', 'Its locally saved session summary will be removed. Any recording remains available until you delete it.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          lifecycleRef.current.discard(
            stopNativeSession,
            () => {
              discardActiveDrive();
              driveRef.current = null;
              elapsedRef.current = 0;
              setDrive(null);
              setElapsed(0);
              setActive(false);
              setRecoveryPending(false);
            },
            setRecoveryActionPending,
          );
        },
      },
    ]);
  };

  const removeRecording = (item: LocalRecording) => {
    Alert.alert('Delete local recording?', 'This cannot be undone. The saved drive summary will remain.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteLocalRecording(item.uri).then(() => {
            forgetRecording(item.uri);
            if (driveRef.current?.recordingUri === item.uri) {
              const updated = { ...driveRef.current, recordingUri: undefined, recordingSizeBytes: undefined };
              driveRef.current = updated;
              setDrive(updated);
            }
            return refreshRecordings();
          });
        },
      },
    ]);
  };

  const removeAllRecordings = () => {
    Alert.alert('Delete all local recordings?', 'This permanently removes every saved drive video from this device. Drive summaries and debriefs remain.', [
      { text: 'Keep recordings', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => {
          void deleteAllLocalRecordings().then(() => {
            forgetAllRecordings();
            if (driveRef.current) {
              const updated = { ...driveRef.current, recordingUri: undefined, recordingSizeBytes: undefined };
              driveRef.current = updated;
              setDrive(updated);
            }
            return refreshRecordings();
          });
        },
      },
    ]);
  };

  const generateDebrief = () => {
    if (!drive) return;
    setDebriefError(false);
    createDebrief.mutate({
      data: {
        durationMinutes: drive.durationMinutes,
        distanceMiles: drive.distanceMiles,
        night: drive.night,
        skills: drive.skills,
        events: summarizeForDebrief(drive.events),
        weakTopics: getMobileWeakTopics(jurisdiction, contentPackVersion, practiceProgress ?? {}),
        jurisdiction,
        contentPackVersion,
      },
    }, {
      onSuccess: (debrief) => {
        const updated = { ...drive, debrief };
        driveRef.current = updated;
        setDrive(updated);
        saveDrive(updated);
      },
      onError: () => setDebriefError(true),
    });
  };

  const gpsSignalGood = locationReady
    && gpsAccuracyMeters !== null
    && gpsAccuracyMeters <= MAX_FIX_ACCURACY_METERS;

  if (active) {
    const showRoadPreview = camerasOn && cameraCoaching;
    const cameraUnavailable = cameraStatus === 'camera-unavailable' || cameraStatus === 'model-unavailable';
    const cameraStarting = cameraStatus === 'starting' || cameraStatus === null;
    const cameraNote = cameraUnavailable
      ? 'Camera coaching unavailable right now. GPS coaching continues.'
      : cameraStarting
        ? 'Starting cameras…'
        : [
          cameraCoaching ? 'Road camera tags moments for review. Frames stay on this phone and are not saved.' : null,
          driverAttention && cameraStatus === 'running' ? 'Driver camera on' : null,
          driverAttention && cameraStatus === 'road-only' ? 'This phone cannot run both cameras; driver camera off' : null,
        ].filter(Boolean).join(' · ');
    const overlayPill = { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 } as const;

    return (
      <Screen>
        <View style={{ flex: 1, paddingBottom: 24 }}>
          <View style={{ marginTop: 12, marginBottom: showRoadPreview ? 16 : 24 }}>
            <Eyebrow>Active coached drive</Eyebrow>
            <Title large>Keep your attention on the road.</Title>
            <Body muted>Coastwise is using location while this drive is active. Keep the screen on in a mount; locking the phone pauses tracking. Do not touch the phone while moving.</Body>
          </View>

          {camerasOn && CoachCameras && (
            <View style={{ marginBottom: 20, gap: 10 }}>
              <View style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: '#05080D' }}>
                <CoachCameras
                  road={cameraCoaching}
                  driver={driverAttention}
                  onDetections={handleDetections}
                  onFace={handleFace}
                  onStatus={handleCameraStatus}
                  previewStyle={{ width: '100%', aspectRatio: 4 / 3 }}
                />
                {showRoadPreview && (
                  <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 14, justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <View style={overlayPill}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cameraStatus === 'running' || cameraStatus === 'road-only' ? '#FF453A' : '#8E8E93' }} />
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>ROAD CAMERA</Text>
                      </View>
                      <View style={overlayPill}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: gpsSignalGood ? '#30D158' : '#FFD60A' }} />
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 }}>GPS</Text>
                      </View>
                    </View>
                    {(cameraUnavailable || cameraStarting) && (
                      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' }}>
                        {cameraUnavailable ? 'Camera unavailable' : 'Starting camera…'}
                      </Text>
                    )}
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={[overlayPill, { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 }]}>
                        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                          {Math.max(1, Math.floor(elapsed / 60))}
                          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}> min</Text>
                        </Text>
                      </View>
                      <View style={[overlayPill, { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 }]}>
                        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                          {(drive?.distanceMiles ?? 0).toFixed(1)}
                          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}> mi</Text>
                        </Text>
                      </View>
                      {speedMph !== null && (
                        <View style={[overlayPill, { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 }]}>
                          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                            {Math.round(speedMph)}
                            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}> mph</Text>
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
              <Text accessibilityLiveRegion="polite" style={{ color: palette.muted, fontSize: 13, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 }}>
                {cameraNote}
              </Text>
            </View>
          )}

          <Card accent padding={showRoadPreview ? 24 : 32}>
            {!showRoadPreview && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 32 }}>
              <View style={{ alignItems: 'center' }}>
                <Eyebrow>Drive time</Eyebrow>
                <Text style={{ color: palette.text, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -2 }}>
                  {Math.max(1, Math.floor(elapsed / 60))}
                  <Text style={{ fontSize: 20, color: palette.muted, fontWeight: '700', letterSpacing: 0 }}> min</Text>
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Eyebrow>Distance</Eyebrow>
                <Text style={{ color: palette.text, fontSize: 48, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -2 }}>
                  {(drive?.distanceMiles ?? 0).toFixed(1)}
                  <Text style={{ fontSize: 20, color: palette.muted, fontWeight: '700', letterSpacing: 0 }}> mi</Text>
                </Text>
              </View>
            </View>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: showRoadPreview ? 16 : 32 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: gpsSignalGood ? palette.success : palette.warning }} />
              <Text style={{ color: gpsSignalGood ? palette.success : palette.warning, fontSize: 16, fontWeight: '700' }}>
                {!locationReady || gpsAccuracyMeters === null
                  ? 'Waiting for GPS (requires clear sky)'
                  : gpsSignalGood
                    ? `GPS strong (±${Math.round(gpsAccuracyMeters)} m)`
                    : `GPS weak (±${Math.round(gpsAccuracyMeters)} m), waiting for a better fix`}
              </Text>
            </View>

            <Text style={{ color: palette.muted, fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 16 }}>
              {speedMph === null ? 'GPS speed estimate unavailable' : `About ${Math.round(speedMph)} mph (GPS estimate)`}
              {mapCoaching && mappedLimitMph !== null ? ` · map limit ${mappedLimitMph}` : ''}
            </Text>
            {mapCoaching && (
              <Text style={{ color: palette.muted, fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
                {mapStatus === 'unavailable'
                  ? 'Map data unavailable right now. GPS coaching continues.'
                  : mapStatus === 'loading'
                    ? 'Loading map data for this area…'
                    : MAP_ATTRIBUTION}
              </Text>
            )}

            <View
              accessibilityLiveRegion="polite"
              style={{ backgroundColor: palette.soft, borderRadius: 16, padding: 16, marginBottom: 16 }}
            >
              <Eyebrow>Coach</Eyebrow>
              <Text style={{ color: palette.text, fontSize: 17, fontWeight: '700', lineHeight: 24 }}>
                {lastCue ?? 'Listening to GPS. Quiet means nothing needed coaching.'}
              </Text>
            </View>

            <View style={{ marginBottom: 16 }}>
              <ActionButton onPress={toggleVoice} secondary>
                {voiceOn ? 'Mute coach voice' : 'Turn coach voice on'}
              </ActionButton>
            </View>
            
            <ActionButton onPress={() => void stopDrive()} destructive>Stop drive while parked</ActionButton>
          </Card>
          
          {recordingPrepared && (
            <CameraView
              ref={cameraRef}
              mode="video"
              mute={!microphonePermission?.granted}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            />
          )}
        </View>
      </Screen>
    );
  }

  const totalRecordingBytes = recordings.reduce((total, item) => total + item.sizeBytes, 0);
  const showStorageWarning = totalRecordingBytes > STORAGE_WARNING_BYTES;

  return (
    <Screen>
      <View style={{ marginTop: 12, marginBottom: 24 }}>
        <Eyebrow>Driving exam</Eyebrow>
        <Title large>Practice with a supervising adult.</Title>
        <Body muted>Location coaching is foreground-only. Coastwise pauses when the app leaves the foreground, and AI is never active during a drive.</Body>
      </View>
      
      {recoveryPending && activeDrive && (
        <Card padding={24} accent>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${palette.warning}18`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="pause" size={24} color={palette.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Eyebrow style={{ color: palette.warning }}>Drive recovered</Eyebrow>
              <Title>{Math.max(1, Math.round(activeDrive.elapsedSeconds / 60))} min saved</Title>
            </View>
          </View>
          <Body>Location and recording were paused when Coastwise was interrupted. Resume only while parked and ready.</Body>
          <View style={{ marginTop: 24, gap: 12 }}>
            <ActionButton onPress={() => void resumeDrive()} disabled={recoveryActionPending}>Resume drive</ActionButton>
            <ActionButton onPress={() => void stopDrive()} secondary disabled={recoveryActionPending}>End and save drive</ActionButton>
            <Pressable
              onPress={discardRecoveredDrive}
              disabled={recoveryActionPending}
              accessibilityState={{ disabled: recoveryActionPending }}
              style={({ pressed }) => [{
                minHeight: 48,
                justifyContent: 'center',
                alignItems: 'center',
                opacity: recoveryActionPending ? 0.5 : pressed ? 0.7 : 1,
                marginTop: 8,
              }]}
            >
              <Text style={{ color: palette.destructive, fontWeight: '700', fontSize: 15 }}>Discard unfinished drive</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {!recoveryPending && (
        <Card padding={24} accent>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="car" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Eyebrow>Before you start</Eyebrow>
              <Title>Ready to go?</Title>
            </View>
          </View>
          <Body>Choose a quiet route, agree on one skill, and let the supervising adult handle the phone. Save the debrief for when you are parked.</Body>
          
          <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: palette.border }}>
            <Eyebrow>Optional local recording</Eyebrow>
            <Body muted>Set this up while parked. If enabled, recording starts with the drive and stops when the drive pauses or ends.</Body>
            <ActionButton onPress={() => void prepareRecording()} secondary={!recordingPrepared}>
              {recordingPrepared ? 'Local recording ready — turn off' : 'Include local video'}
            </ActionButton>
          </View>

          <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: palette.border }}>
            <Eyebrow>Coach voice</Eyebrow>
            <Body muted>
              {coachVoice
                ? `Using ${coachVoice.name} (${coachVoice.tier === 'standard' ? 'basic quality' : coachVoice.tier}).`
                : 'Using the default iPhone voice.'}
              {coachVoice?.tier === 'premium'
                ? ''
                : ' For a more natural coach, download a Premium English voice such as Ava or Zoe in iPhone Settings → Accessibility → Spoken Content → Voices → English. Coastwise switches to it automatically.'}
            </Body>
            <ActionButton
              onPress={() => {
                if (!voiceOnRef.current) toggleVoice();
                void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: false })
                  .catch(() => undefined)
                  .finally(() => speakCue('Nice and smooth. Keep about three seconds behind the car ahead.'));
              }}
              secondary
            >
              Preview coach voice
            </ActionButton>
          </View>

          <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: palette.border }}>
            <Eyebrow>Optional map coaching</Eyebrow>
            <Body muted>
              Coaches stops at mapped stop signs and speed against mapped limits. Coastwise downloads OpenStreetMap data for the roughly 2 km square you are in. Your exact position and route are not sent. Map data can be missing or out of date.
            </Body>
            <ActionButton onPress={toggleMapCoaching} secondary={!mapCoaching}>
              {mapCoaching ? 'Map coaching on — turn off' : 'Turn on map coaching'}
            </ActionButton>
          </View>

          <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: palette.border }}>
            <Eyebrow>Camera coaching (beta)</Eyebrow>
            {CoachCameras ? (
              <>
                <Body muted>
                  Mount the phone facing the road. The road camera looks for stop signs and the car ahead, and tags moments for your post-drive review. It does not speak during the drive yet. Frames are analyzed on this phone and never saved or sent. Detection can be wrong.
                </Body>
                <ActionButton onPress={toggleCameraCoaching} secondary={!cameraCoaching}>
                  {cameraCoaching ? 'Road camera on — turn off' : 'Turn on road camera'}
                </ActionButton>
                <View style={{ marginTop: 8 }}>
                  <ActionButton onPress={toggleDriverAttention} secondary={!driverAttention}>
                    {driverAttention ? 'Driver camera on — turn off' : 'Also watch where the driver looks'}
                  </ActionButton>
                </View>
              </>
            ) : (
              <Body muted>Camera coaching needs the installed Coastwise app build. It is not available in Expo Go.</Body>
            )}
          </View>

          <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: palette.border }}>
            <Eyebrow>Recording retention</Eyebrow>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {[7, 14, 30, 'forever'].map((days) => (
                <Pressable
                  key={String(days)}
                  onPress={() => setRecordingRetention(days as any)}
                   accessibilityRole="radio"
                   accessibilityState={{ selected: recordingRetentionDays === days }}
                   accessibilityLabel={days === 'forever' ? 'Keep recordings forever' : `Delete recordings after ${days} days`}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 12,
                    backgroundColor: recordingRetentionDays === days ? colors.primary : palette.soft,
                  }}
                >
                  <Text style={{ 
                    fontSize: 13, 
                    fontWeight: '700', 
                    color: recordingRetentionDays === days ? '#FFFFFF' : palette.text 
                  }}>
                    {days === 'forever' ? 'Keep forever' : `${days} days`}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={{ color: palette.muted, fontSize: 13, marginTop: 12 }}>
              Storage used: {storageLoading ? '...' : formatStorageSize(totalRecordingBytes)}
               {showStorageWarning && <Text style={{ color: palette.warning }}> (Review or delete older videos)</Text>}
            </Text>
          </View>

          <View style={{ marginTop: 24 }}>
            <ActionButton onPress={() => void startDrive()}>Start coached drive</ActionButton>
          </View>
        </Card>
      )}

      {drive && !recoveryPending && (
        <Card padding={24}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: `${palette.success}18`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-done" size={24} color={palette.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Eyebrow style={{ color: palette.success }}>Saved locally</Eyebrow>
              <Title>{drive.durationMinutes} min drive</Title>
            </View>
          </View>
          
          <View style={{ backgroundColor: palette.soft, borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name={drive.night ? "moon" : "sunny"} size={16} color={palette.text} />
              <Text style={{ color: palette.text, fontWeight: '600' }}>{drive.night ? 'Night practice' : 'Day practice'}</Text>
              <Text style={{ color: palette.muted }}>·</Text>
              <Text style={{ color: palette.text, fontWeight: '600' }}>{drive.distanceMiles.toFixed(1)} miles</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Ionicons name="git-merge" size={16} color={palette.text} />
              <Text style={{ color: palette.text, fontWeight: '600' }}>{drive.skills.join(' and ')}</Text>
            </View>
            {(drive.events?.length ?? 0) > 0 && (
              <View style={{ marginTop: 12, gap: 6 }}>
                {drive.events!.slice(-5).reverse().map((event, index) => (
                  <Text key={`${event.secondsIntoDrive}-${event.kind}-${index}`} style={{ color: palette.text, fontSize: 14 }}>
                    <Text style={{ fontWeight: '700' }}>{coachTitle(event.kind)}</Text>
                    {` at ${Math.floor(event.secondsIntoDrive / 60)}:${String(event.secondsIntoDrive % 60).padStart(2, '0')}. ${describeEvent(event)}`}
                  </Text>
                ))}
              </View>
            )}
            {drive.recordingSizeBytes !== undefined && (
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <Ionicons name="videocam" size={16} color={palette.text} />
                <Text style={{ color: palette.text, fontWeight: '600' }}>{formatStorageSize(drive.recordingSizeBytes)} video saved</Text>
              </View>
            )}
          </View>
          
          {drive.debrief ? (
            <View style={{ backgroundColor: `${colors.primary}10`, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: `${colors.primary}20` }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>AI Debrief</Text>
              </View>
              <Text style={{ color: palette.text, fontSize: 20, fontWeight: '800', marginBottom: 8, lineHeight: 26 }}>{drive.debrief.headline}</Text>
              <Text style={{ color: palette.text, fontSize: 15, lineHeight: 22 }}>{drive.debrief.nextStep}</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <ActionButton onPress={generateDebrief} disabled={createDebrief.isPending}>
                {createDebrief.isPending ? <ActivityIndicator color="#FFFFFF" /> : 'Generate private AI debrief'}
              </ActionButton>
              {debriefError && (
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                  <Ionicons name="warning" size={16} color={palette.warning} />
                  <Text style={{ color: palette.warning, fontSize: 13, fontWeight: '600' }}>Debrief unavailable. Try again later.</Text>
                </View>
              )}
            </View>
          )}
        </Card>
      )}

      <Card padding={24}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="folder" size={24} color={palette.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Eyebrow>Local recordings</Eyebrow>
            <Title>{storageLoading ? 'Checking...' : `${recordings.length} saved`}</Title>
          </View>
        </View>
        
        {recordings.length > 0 ? (
          <>
            <Text style={{ color: palette.muted, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
              {formatStorageSize(totalRecordingBytes)} used. Recordings never enter AI requests or family sync.
            </Text>
            <View style={{ backgroundColor: palette.soft, borderRadius: 16, overflow: 'hidden' }}>
              {recordings.map((item, index) => (
                <View key={item.uri} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: index < recordings.length - 1 ? 1 : 0, borderBottomColor: palette.border }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="videocam" size={18} color={palette.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: palette.text, fontWeight: '700', fontSize: 16 }}>{recordingDate(item)}</Text>
                    <Text style={{ color: palette.muted, marginTop: 2, fontSize: 13 }}>{formatStorageSize(item.sizeBytes)}</Text>
                  </View>
                  <Pressable 
                    onPress={() => removeRecording(item)} 
                    accessibilityRole="button" 
                    accessibilityLabel={`Delete recording from ${recordingDate(item)}`} 
                    style={({ pressed }) => [{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: pressed ? `${palette.destructive}18` : 'transparent' }]}
                  >
                    <Ionicons name="trash" size={20} color={palette.destructive} />
                  </Pressable>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 16 }}>
              <ActionButton onPress={removeAllRecordings} secondary destructive>Delete all recordings</ActionButton>
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Ionicons name="videocam-outline" size={48} color={palette.border} style={{ marginBottom: 16 }} />
            <Text style={{ color: palette.muted, textAlign: 'center', fontSize: 15, lineHeight: 22 }}>
              No drive videos are stored on this device.
            </Text>
          </View>
        )}
      </Card>

      {drives.length > 0 && (
        <Text style={{ color: palette.muted, textAlign: 'center', marginTop: 16, marginBottom: 8, fontSize: 14 }}>
          {drives.length} saved drive{drives.length === 1 ? '' : 's'} on this device.
        </Text>
      )}
    </Screen>
  );
}
