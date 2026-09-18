import { useCreateDriveDebrief } from '@workspace/api-client-react';
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraView as CameraViewType } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, Text, View } from 'react-native';
import { ActionButton, Body, Card, Eyebrow, Screen, Title, usePalette, styles } from '@/components/ui';
import { useCoastwise, type MobileDrive } from '@/lib/coastwise-context';

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

export default function DriveScreen() {
  const palette = usePalette();
  const { drives, saveDrive } = useCoastwise();
  const cameraRef = useRef<CameraViewType | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastCoordinates = useRef<Location.LocationObjectCoords | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [locationReady, setLocationReady] = useState(false);
  const [active, setActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [drive, setDrive] = useState<MobileDrive | null>(null);
  const [debriefError, setDebriefError] = useState(false);
  const createDebrief = useCreateDriveDebrief();

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now() - elapsed * 1000;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [active]);

  useEffect(() => () => {
    locationSubscription.current?.remove();
    cameraRef.current?.stopRecording();
  }, []);

  const startDrive = async () => {
    const location = await Location.requestForegroundPermissionsAsync();
    if (location.status !== Location.PermissionStatus.GRANTED) {
      explainPermission('Location', location);
      return;
    }
    setLocationReady(true);
    setActive(true);
    setElapsed(0);
    const newDrive: MobileDrive = {
      id: `drive-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: new Date().toISOString(),
      durationMinutes: 1,
      distanceMiles: 0,
      night: new Date().getHours() < 7 || new Date().getHours() >= 19,
      skills: DRIVE_SKILLS,
    };
    setDrive(newDrive);
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
        if (miles > 0 && miles < 0.25) {
          setDrive((current) => current ? { ...current, distanceMiles: current.distanceMiles + miles } : current);
        }
      },
    );
  };

  const startRecording = async () => {
    const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    const microphone = microphonePermission?.granted ? microphonePermission : await requestMicrophonePermission();
    if (!camera.granted) {
      explainPermission('Camera', camera);
      return;
    }
    if (!microphone.granted) {
      explainPermission('Microphone', microphone);
      return;
    }
    if (!cameraRef.current) return;
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 3600 });
      if (result?.uri && FileSystem.documentDirectory) {
        const destination = `${FileSystem.documentDirectory}drive-${Date.now()}.mp4`;
        await FileSystem.copyAsync({ from: result.uri, to: destination });
      }
    } finally {
      setRecording(false);
    }
  };

  const stopDrive = () => {
    cameraRef.current?.stopRecording();
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    lastCoordinates.current = null;
    const finished = drive ? { ...drive, durationMinutes: Math.max(1, Math.round(elapsed / 60)) } : null;
    setDrive(finished);
    setActive(false);
    setLocationReady(false);
    if (finished) saveDrive(finished);
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
        setDrive(updated);
        saveDrive(updated);
      },
      onError: () => setDebriefError(true),
    });
  };

  if (active) {
    return <Screen scroll={false}><Eyebrow>Active coached drive</Eyebrow><Title>Keep your attention on the road.</Title><Body muted>Coastwise is using location while this drive is active. Do not touch the phone while moving. Pull over before stopping, reviewing, or recording.</Body><Card accent><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View><Eyebrow>Drive time</Eyebrow><Text style={{ color: palette.text, fontSize: 34, fontWeight: '800' }}>{Math.max(1, Math.round(elapsed / 60))}<Text style={{ fontSize: 15 }}> min</Text></Text></View><View><Eyebrow>Location</Eyebrow><Text style={{ color: palette.success, fontSize: 15, fontWeight: '800' }}>{locationReady ? 'Active' : 'Waiting'}</Text></View></View><ActionButton onPress={stopDrive} secondary>Stop drive while parked</ActionButton></Card>{cameraPermission?.granted && <View style={{ marginTop: 16, overflow: 'hidden', borderRadius: 18, backgroundColor: '#0B1117' }}><CameraView ref={cameraRef} mode="video" style={{ height: 210 }} mute={!microphonePermission?.granted} /><Pressable onPress={recording ? () => cameraRef.current?.stopRecording() : () => void startRecording()} accessibilityRole="button" style={{ position: 'absolute', bottom: 14, left: 14, right: 14, borderRadius: 12, padding: 13, alignItems: 'center', backgroundColor: recording ? '#B64242' : '#FFFFFF' }}><Text style={{ color: recording ? '#FFFFFF' : '#17212B', fontWeight: '800' }}>{recording ? 'Stop local recording' : 'Record optional local review'}</Text></Pressable></View>}<ActionButton onPress={() => void startRecording()} disabled={recording} secondary>{cameraPermission?.granted ? 'Open local camera review' : 'Allow optional camera review'}</ActionButton><Body muted>Recordings remain in this device’s app storage. They are never included in AI requests.</Body></Screen>;
  }

  return <Screen><Eyebrow>Driving exam</Eyebrow><Title>Practice with a supervising adult.</Title><Body muted>Location coaching is foreground-only. Coastwise does not track you in the background, and AI is never active during a drive.</Body><Card accent><Eyebrow>Before you start</Eyebrow><Body>Choose a quiet route, agree on one skill, and let the supervising adult handle the phone. Save the debrief for when you are parked.</Body><ActionButton onPress={() => void startDrive()}>Start coached drive</ActionButton></Card>{drive && <Card><Eyebrow>Drive saved locally</Eyebrow><Title>{drive.durationMinutes} minute drive</Title><Body muted>{drive.night ? 'Night practice' : 'Day practice'} · {drive.distanceMiles.toFixed(1)} miles · {drive.skills.join(' and ')}</Body>{drive.debrief ? <><Text style={{ color: palette.text, fontSize: 19, fontWeight: '800', marginTop: 14 }}>{drive.debrief.headline}</Text><Body>{drive.debrief.nextStep}</Body></> : <><ActionButton onPress={generateDebrief} disabled={createDebrief.isPending}>{createDebrief.isPending ? <ActivityIndicator color="#FFFFFF" /> : 'Generate private debrief'}</ActionButton>{debriefError && <Body muted>The debrief is unavailable right now. Your drive is still saved locally.</Body>}</>}</Card>}{drives.length > 0 && <Body muted>{drives.length} saved drive{drives.length === 1 ? '' : 's'} on this device.</Body>}</Screen>;
}