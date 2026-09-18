import { useCreateDriveDebrief } from '@workspace/api-client-react';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraView as CameraViewType } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Platform, Pressable, Text, View } from 'react-native';
import { ActionButton, Body, Card, Eyebrow, Screen, Title, usePalette } from '@/components/ui';
import { useCoastwise, type ActiveMobileDrive, type MobileDrive } from '@/lib/coastwise-context';
import {
  deleteAllLocalRecordings,
  deleteLocalRecording,
  formatStorageSize,
  listLocalRecordings,
  type LocalRecording,
} from '@/lib/recordings';

const DRIVE_SKILLS = ['turns', 'intersections'];
const WEAK_TOPICS = [
  { topic: 'Right-of-way', mastery: 0 },
  { topic: 'Signs & signals', mastery: 0 },
  { topic: 'Safe speed', mastery: 0 },
];

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

function completedDrive(drive: MobileDrive, elapsedSeconds: number): MobileDrive {
  const { startedAt: _startedAt, elapsedSeconds: _elapsedSeconds, ...completed } = drive as ActiveMobileDrive;
  return { ...completed, durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)) };
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
    beginActiveDrive,
    updateActiveDrive,
    finishActiveDrive,
    discardActiveDrive,
    saveDrive,
    forgetRecording,
    forgetAllRecordings,
  } = useCoastwise();
  const cameraRef = useRef<CameraViewType | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastCoordinates = useRef<Location.LocationObjectCoords | null>(null);
  const driveRef = useRef<MobileDrive | null>(null);
  const elapsedRef = useRef(0);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [locationReady, setLocationReady] = useState(false);
  const [active, setActive] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [drive, setDrive] = useState<MobileDrive | null>(null);
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [storageLoading, setStorageLoading] = useState(true);
  const [debriefError, setDebriefError] = useState(false);
  const createDebrief = useCreateDriveDebrief();

  const refreshRecordings = useCallback(async () => {
    setStorageLoading(true);
    try {
      setRecordings(await listLocalRecordings());
    } finally {
      setStorageLoading(false);
    }
  }, []);

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
    setRecoveryPending(true);
  }, [active, activeDrive, hydrated]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const nextElapsed = elapsedRef.current + 1;
      elapsedRef.current = nextElapsed;
      setElapsed(nextElapsed);
      const current = driveRef.current;
      if (current && nextElapsed % 5 === 0) {
        const updated: ActiveMobileDrive = {
          ...current,
          startedAt: activeDrive?.startedAt ?? new Date().toISOString(),
          elapsedSeconds: nextElapsed,
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
    lastCoordinates.current = null;
    setLocationReady(false);
  }, []);

  const pauseForInterruption = useCallback(() => {
    const current = driveRef.current;
    if (!current) return;
    stopNativeSession();
    const paused: ActiveMobileDrive = {
      ...current,
      startedAt: activeDrive?.startedAt ?? new Date().toISOString(),
      elapsedSeconds: elapsedRef.current,
    };
    driveRef.current = paused;
    setDrive(paused);
    updateActiveDrive(paused);
    setActive(false);
    setRecoveryPending(true);
  }, [activeDrive?.startedAt, stopNativeSession, updateActiveDrive]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (active && state !== 'active') pauseForInterruption();
    });
    return () => subscription.remove();
  }, [active, pauseForInterruption]);

  useEffect(() => () => stopNativeSession(), [stopNativeSession]);

  const beginLocationTracking = async (session: ActiveMobileDrive) => {
    const location = await Location.requestForegroundPermissionsAsync();
    if (location.status !== Location.PermissionStatus.GRANTED) {
      explainPermission('Location', location);
      return false;
    }
    try {
      lastCoordinates.current = null;
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 20, timeInterval: 5000 },
        ({ coords }) => {
          const previous = lastCoordinates.current;
          lastCoordinates.current = coords;
          if (!previous) return;
          const toRadians = (degrees: number) => degrees * Math.PI / 180;
          const latitudeDelta = toRadians(coords.latitude - previous.latitude);
          const longitudeDelta = toRadians(coords.longitude - previous.longitude);
          const a = Math.sin(latitudeDelta / 2) ** 2
            + Math.cos(toRadians(previous.latitude)) * Math.cos(toRadians(coords.latitude))
            * Math.sin(longitudeDelta / 2) ** 2;
          const miles = 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (miles <= 0 || miles >= 0.25) return;
          const current = driveRef.current;
          if (!current) return;
          const updated: ActiveMobileDrive = {
            ...current,
            distanceMiles: current.distanceMiles + miles,
            startedAt: session.startedAt,
            elapsedSeconds: elapsedRef.current,
          };
          driveRef.current = updated;
          setDrive(updated);
          updateActiveDrive(updated);
        },
      );
      driveRef.current = session;
      elapsedRef.current = session.elapsedSeconds;
      setDrive(session);
      setElapsed(session.elapsedSeconds);
      setLocationReady(true);
      setRecoveryPending(false);
      setActive(true);
      return true;
    } catch {
      Alert.alert('Location unavailable', 'Coastwise could not start foreground location. Your saved progress is unchanged.');
      stopNativeSession();
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
    };
    if (await beginLocationTracking(session)) beginActiveDrive(session);
  };

  const resumeDrive = async () => {
    if (activeDrive) await beginLocationTracking(activeDrive);
  };

  const startRecording = async () => {
    const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    await (microphonePermission?.granted ? Promise.resolve(microphonePermission) : requestMicrophonePermission());
    if (!camera.granted) {
      explainPermission('Camera', camera);
      return;
    }
    if (!cameraRef.current) return;
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 3600 });
      if (!result?.uri || !FileSystem.documentDirectory) return;
      const destination = `${FileSystem.documentDirectory}coastwise-drive-${Date.now()}.mp4`;
      await FileSystem.copyAsync({ from: result.uri, to: destination });
      const info = await FileSystem.getInfoAsync(destination);
      const current = driveRef.current;
      if (current) {
        const updated = {
          ...current,
          recordingUri: destination,
          recordingSizeBytes: info.exists ? info.size ?? 0 : 0,
        };
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
    } catch {
      Alert.alert('Recording unavailable', 'Coastwise could not save this recording. Your drive summary is still safe.');
    } finally {
      setRecording(false);
    }
  };

  const stopDrive = () => {
    stopNativeSession();
    const current = driveRef.current;
    if (!current) return;
    const finished = completedDrive(current, elapsedRef.current);
    driveRef.current = finished;
    setDrive(finished);
    finishActiveDrive(finished);
    setActive(false);
    setRecoveryPending(false);
  };

  const discardRecoveredDrive = () => {
    Alert.alert('Discard unfinished drive?', 'Its locally saved session summary will be removed. Any recording remains available until you delete it.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          discardActiveDrive();
          driveRef.current = null;
          elapsedRef.current = 0;
          setDrive(null);
          setElapsed(0);
          setRecoveryPending(false);
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
        events: [],
        weakTopics: WEAK_TOPICS,
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

  if (active) {
    return <Screen scroll={false}><Eyebrow>Active coached drive</Eyebrow><Title>Keep your attention on the road.</Title><Body muted>Coastwise is using location while this drive is active. Do not touch the phone while moving. Pull over before stopping, reviewing, or recording.</Body><Card accent><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View><Eyebrow>Drive time</Eyebrow><Text style={{ color: palette.text, fontSize: 34, fontWeight: '800' }}>{Math.max(1, Math.round(elapsed / 60))}<Text style={{ fontSize: 15 }}> min</Text></Text></View><View><Eyebrow>Location</Eyebrow><Text style={{ color: palette.success, fontSize: 15, fontWeight: '800' }}>{locationReady ? 'Active' : 'Waiting'}</Text></View></View><ActionButton onPress={stopDrive} secondary>Stop drive while parked</ActionButton></Card>{cameraPermission?.granted && <View style={{ marginTop: 16, overflow: 'hidden', borderRadius: 18, backgroundColor: '#0B1117' }}><CameraView ref={cameraRef} mode="video" style={{ height: 210 }} mute={!microphonePermission?.granted} /><Pressable onPress={recording ? () => cameraRef.current?.stopRecording() : () => void startRecording()} accessibilityRole="button" style={{ position: 'absolute', bottom: 14, left: 14, right: 14, borderRadius: 12, padding: 13, alignItems: 'center', backgroundColor: recording ? '#B64242' : '#FFFFFF' }}><Text style={{ color: recording ? '#FFFFFF' : '#17212B', fontWeight: '800' }}>{recording ? 'Stop local recording' : 'Record optional local review'}</Text></Pressable></View>}<ActionButton onPress={() => void startRecording()} disabled={recording} secondary>{cameraPermission?.granted ? 'Open local camera review' : 'Allow optional camera review'}</ActionButton><Body muted>Recordings remain in this device’s app storage. They are never included in AI requests.</Body></Screen>;
  }

  const totalRecordingBytes = recordings.reduce((total, item) => total + item.sizeBytes, 0);
  return <Screen><Eyebrow>Driving exam</Eyebrow><Title>Practice with a supervising adult.</Title><Body muted>Location coaching is foreground-only. Coastwise pauses when the app leaves the foreground, and AI is never active during a drive.</Body>
    {recoveryPending && activeDrive && <Card accent><Eyebrow>Unfinished drive recovered</Eyebrow><Title>{Math.max(1, Math.round(activeDrive.elapsedSeconds / 60))} minutes saved</Title><Body muted>Location and recording were paused when Coastwise was interrupted. Resume only while parked and ready, or save the session as it is.</Body><ActionButton onPress={() => void resumeDrive()}>Resume coached drive</ActionButton><ActionButton onPress={stopDrive} secondary>End and save drive</ActionButton><Pressable onPress={discardRecoveredDrive} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 8 }}><Text style={{ color: palette.warning, fontWeight: '800' }}>Discard unfinished drive</Text></Pressable></Card>}
    {!recoveryPending && <Card accent><Eyebrow>Before you start</Eyebrow><Body>Choose a quiet route, agree on one skill, and let the supervising adult handle the phone. Save the debrief for when you are parked.</Body><ActionButton onPress={() => void startDrive()}>Start coached drive</ActionButton></Card>}
    {drive && !recoveryPending && <Card><Eyebrow>Drive saved locally</Eyebrow><Title>{drive.durationMinutes} minute drive</Title><Body muted>{drive.night ? 'Night practice' : 'Day practice'} · {drive.distanceMiles.toFixed(1)} miles · {drive.skills.join(' and ')}</Body>{drive.recordingSizeBytes !== undefined && <Body muted>Local recording: {formatStorageSize(drive.recordingSizeBytes)}</Body>}{drive.debrief ? <><Text style={{ color: palette.text, fontSize: 19, fontWeight: '800', marginTop: 14 }}>{drive.debrief.headline}</Text><Body>{drive.debrief.nextStep}</Body></> : <><ActionButton onPress={generateDebrief} disabled={createDebrief.isPending}>{createDebrief.isPending ? <ActivityIndicator color="#FFFFFF" /> : 'Generate private debrief'}</ActionButton>{debriefError && <Body muted>The debrief is unavailable right now. Your drive is still saved locally.</Body>}</>}</Card>}
    <Card><Eyebrow>Local recordings</Eyebrow><Title>{storageLoading ? 'Checking storage…' : `${recordings.length} recording${recordings.length === 1 ? '' : 's'}`}</Title><Body muted>{recordings.length > 0 ? `${formatStorageSize(totalRecordingBytes)} used in Coastwise app storage. Recordings never enter AI requests or family sync.` : 'No drive videos are stored on this device.'}</Body>{recordings.map((item) => <View key={item.uri} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: palette.border }}><View style={{ flex: 1 }}><Text style={{ color: palette.text, fontWeight: '800' }}>{recordingDate(item)}</Text><Text style={{ color: palette.muted, marginTop: 3 }}>{formatStorageSize(item.sizeBytes)}</Text></View><Pressable onPress={() => removeRecording(item)} accessibilityRole="button" accessibilityLabel={`Delete recording from ${recordingDate(item)}`} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: palette.warning, fontWeight: '800' }}>Delete</Text></Pressable></View>)}{recordings.length > 0 && <ActionButton onPress={removeAllRecordings} secondary>Delete all recordings</ActionButton>}</Card>
    {drives.length > 0 && <Body muted>{drives.length} saved drive{drives.length === 1 ? '' : 's'} on this device.</Body>}
  </Screen>;
}