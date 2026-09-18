import { useCreateNextDrivePlan } from '@workspace/api-client-react';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ActionButton, Body, Card, Eyebrow, IconRow, Screen, Title, usePalette, styles } from '@/components/ui';
import { buildNextDrivePlanInput } from '@/lib/plan-input';
import { useCoastwise } from '@/lib/coastwise-context';

export default function TodayScreen() {
  const palette = usePalette();
  const { drives, plan, savePlan, acknowledgedPrivacyVersion, acknowledgePrivacy } = useCoastwise();
  const createPlan = useCreateNextDrivePlan();
  const [showPrivacy, setShowPrivacy] = useState(!acknowledgedPrivacyVersion);

  if (showPrivacy) {
    return <Screen scroll={false}><View style={{ flex: 1, justifyContent: 'center' }}><Eyebrow>Important update · September 18, 2026</Eyebrow><Title large>Optional AI drive debriefs</Title><Body muted>Coastwise can create a coaching summary from a limited drive summary. Videos, precise routes, identity, family notes, and raw answers stay on this device.</Body><Card accent><IconRow icon="lock-closed-outline" title="Only when you choose it" detail="AI is never active during a drive. You choose Generate debrief after stopping." /><IconRow icon="shield-checkmark-outline" title="Limited summary only" detail="Duration, distance, night status, skills, coach-event text, and low-mastery topics are sent." /></Card><ActionButton onPress={() => { acknowledgePrivacy(); setShowPrivacy(false); }}>I understand and agree</ActionButton><Text style={{ color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 }}>You can review this privacy notice from Parent at any time.</Text></View></Screen>;
  }

  const generatePlan = () => createPlan.mutate({ data: buildNextDrivePlanInput(drives) }, { onSuccess: savePlan });
  return <Screen><Eyebrow>Good to see you</Eyebrow><Title large>What are you working on today?</Title><Body muted>One clear goal makes supervised practice calmer and more useful.</Body>
    <Card accent><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={{ flex: 1 }}><Eyebrow>Next supervised drive</Eyebrow><Title>{plan?.skillFocus ?? 'Build a simple plan'}</Title></View><Text style={{ fontSize: 30, fontWeight: '800', color: '#0084FF' }}>{plan?.durationMinutes ?? '—'}<Text style={{ fontSize: 13 }}> min</Text></Text></View>{plan && <><Body>{plan.safetyGuidance}</Body><Body muted>Ask: {plan.parentPrompt}</Body></>}{createPlan.isError && <Body muted>Planning is unavailable right now. Your saved progress is still here.</Body>}<ActionButton onPress={generatePlan} disabled={createPlan.isPending}>{createPlan.isPending ? <ActivityIndicator color="#FFFFFF" /> : plan ? 'Refresh plan' : 'Create my plan'}</ActionButton></Card>
    <View style={{ marginTop: 24 }}><Eyebrow>Your path</Eyebrow><IconRow icon="book-outline" title="Permit & knowledge" detail="Practice the handbook and revisit weak topics." /><IconRow icon="car-outline" title="Coached drive" detail="Use native location and camera features only when you choose." /><IconRow icon="heart-outline" title="Parent conversation" detail="Review wins and choose one next step together." /></View>
    <Link href="/(tabs)/drive" asChild><ActionButton onPress={() => undefined} secondary>Open drive coach</ActionButton></Link>
  </Screen>;
}