import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { Body, Card, Eyebrow, IconRow, Screen, Title, usePalette } from '@/components/ui';
import { useCoastwise } from '@/lib/coastwise-context';

export default function ParentScreen() {
  const palette = usePalette();
  const { drives, plan } = useCoastwise();
  const lastDrive = drives[0];
  return <Screen><Eyebrow>Parent view</Eyebrow><Title>Keep practice calm and specific.</Title><Body muted>Coastwise keeps drive media and precise locations on the driver’s device. Use this view to talk through progress while parked.</Body>
    <Card><Eyebrow>Recent practice</Eyebrow>{lastDrive ? <><Text style={{ color: palette.text, fontSize: 25, fontWeight: '800' }}>{lastDrive.durationMinutes} minutes</Text><Body muted>{lastDrive.night ? 'Night drive' : 'Day drive'} · {lastDrive.distanceMiles.toFixed(1)} miles</Body>{lastDrive.debrief && <><Text style={{ color: palette.text, fontSize: 17, fontWeight: '800', marginTop: 14 }}>{lastDrive.debrief.headline}</Text><Body>{lastDrive.debrief.nextStep}</Body></>}</> : <Body muted>No saved drives yet. Start a supervised drive when you are parked and ready.</Body>}</Card>
    {plan && <Card accent><Eyebrow>Next drive</Eyebrow><IconRow icon="flag-outline" title={plan.skillFocus} detail={`${plan.durationMinutes} minutes · ${plan.safetyGuidance}`} /><Body muted>Ask: {plan.parentPrompt}</Body></Card>}
    <Card><Eyebrow>Safety boundary</Eyebrow><IconRow icon="hand-left-outline" title="Park before reviewing" detail="The supervising adult handles setup and conversation. Never interact with Coastwise while the vehicle is moving." /><IconRow icon="lock-closed-outline" title="Local by default" detail="Videos, precise routes, notes, and coaching positions are not included in family sync or AI summaries." /></Card>
    <Link href="/privacy" asChild><Text style={{ color: '#0084FF', fontWeight: '800', marginTop: 22 }}>Review privacy details →</Text></Link>
  </Screen>;
}