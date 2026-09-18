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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

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
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, paddingBottom: 24 }}>
          <View style={{ marginTop: 12, marginBottom: 24 }}>
            <Eyebrow>Active coached drive</Eyebrow>
            <Title large>Keep your attention on the road.</Title>
            <Body muted>Coastwise is using location while this drive is active. Do not touch the phone while moving. Pull over before stopping or reviewing.</Body>
          </View>
          
          <Card accent padding={32}>
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <Eyebrow>Drive time</Eyebrow>
              <Text style={{ color: palette.text, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -2 }}>
                {Math.max(1, Math.floor(elapsed / 60))}
                <Text style={{ fontSize: 24, color: palette.muted, fontWeight: '700', letterSpacing: 0 }}> min</Text>
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: locationReady ? palette.success : palette.warning }} />
              <Text style={{ color: locationReady ? palette.success : palette.warning, fontSize: 16, fontWeight: '700' }}>
                {locationReady ? 'Location active' : 'Waiting for GPS...'}
              </Text>
            </View>
            
            <ActionButton onPress={stopDrive} destructive>Stop drive while parked</ActionButton>
          </Card>
          
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            {cameraPermission?.granted ? (
              <View style={{ marginTop: 24, overflow: 'hidden', borderRadius: 24, backgroundColor: '#0B1117', borderWidth: 1, borderColor: palette.border }}>
                <CameraView ref={cameraRef} mode="video" style={{ height: 220 }} mute={!microphonePermission?.granted} />
                <View style={{ position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  {recording && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' }} />}
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>{recording ? 'RECORDING' : 'READY'}</Text>
                </View>
                <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
                  <ActionButton onPress={recording ? () => cameraRef.current?.stopRecording() : () => void startRecording()} secondary={!recording} destructive={recording}>
                    {recording ? 'Stop local recording' : 'Record optional local review'}
                  </ActionButton>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 24 }}>
                <ActionButton onPress={() => void startRecording()} secondary>Allow optional camera review</ActionButton>
                <Text style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: palette.muted, paddingHorizontal: 20 }}>
                  Recordings remain in this device's app storage. They are never included in AI requests.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Screen>
    );
  }

  const totalRecordingBytes = recordings.reduce((total, item) => total + item.sizeBytes, 0);

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
            <ActionButton onPress={() => void resumeDrive()}>Resume drive</ActionButton>
            <ActionButton onPress={stopDrive} secondary>End and save drive</ActionButton>
            <Pressable onPress={discardRecoveredDrive} style={({ pressed }) => [{ minHeight: 48, justifyContent: 'center', alignItems: 'center', opacity: pressed ? 0.7 : 1, marginTop: 8 }]}>
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
