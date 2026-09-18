import { useCreateNextDrivePlan } from '@workspace/api-client-react';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { ActionButton, Body, Card, Eyebrow, IconRow, Screen, Title, usePalette } from '@/components/ui';
import { buildNextDrivePlanInput } from '@/lib/plan-input';
import { useCoastwise } from '@/lib/coastwise-context';
import { colors } from '@/theme';
import { Ionicons } from '@expo/vector-icons';

export default function TodayScreen() {
  const palette = usePalette();
  const { drives, plan, savePlan, acknowledgedPrivacyVersion, acknowledgePrivacy } = useCoastwise();
  const createPlan = useCreateNextDrivePlan();
  const [showPrivacy, setShowPrivacy] = useState(!acknowledgedPrivacyVersion);

  if (showPrivacy) {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
             <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          </View>
          <Eyebrow>Important update</Eyebrow>
          <Title large>Optional AI debriefs</Title>
          <Body muted>Coastwise can create a coaching summary from a limited drive summary. Videos, precise routes, identity, family notes, and raw answers always stay on this device.</Body>
          
          <View style={{ marginTop: 24 }}>
            <Card accent>
              <IconRow icon="lock-closed" title="Only when you choose it" detail="AI is never active during a drive. You choose Generate debrief after stopping." accent />
              <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 4, marginLeft: 64 }} />
              <IconRow icon="shield-checkmark" title="Limited summary only" detail="Duration, distance, night status, skills, coach-event text, and low-mastery topics are sent." accent />
            </Card>
          </View>
          
          <View style={{ marginTop: 32 }}>
            <ActionButton onPress={() => { acknowledgePrivacy(); setShowPrivacy(false); }}>I understand and agree</ActionButton>
            <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 20, fontWeight: '500' }}>You can review this privacy notice from Parent at any time.</Text>
          </View>
        </View>
      </Screen>
    );
  }

  const generatePlan = () => createPlan.mutate({ data: buildNextDrivePlanInput(drives) }, { onSuccess: savePlan });
  
  return (
    <Screen>
      <View style={{ marginTop: 12, marginBottom: 24 }}>
        <Eyebrow>Good to see you</Eyebrow>
        <Title large>What are you working on today?</Title>
        <Body muted>One clear goal makes supervised practice calmer and more useful.</Body>
      </View>
      
      <Card accent padding={24}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: plan ? 20 : 0 }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Eyebrow>Next supervised drive</Eyebrow>
            <Title>{plan?.skillFocus ?? 'Build a simple plan'}</Title>
          </View>
          <View style={{ alignItems: 'center', backgroundColor: palette.soft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: '800', color: palette.text, letterSpacing: -1 }}>{plan?.durationMinutes ?? '—'}</Text>
            <Text style={{ fontSize: 13, color: palette.muted, fontWeight: '700', marginTop: -4 }}>min</Text>
          </View>
        </View>
        
        {plan && (
          <View style={{ gap: 12, marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Ionicons name="information-circle" size={20} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Body>{plan.safetyGuidance}</Body>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Ionicons name="chatbubbles" size={20} color={colors.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Body muted>Ask: {plan.parentPrompt}</Body>
              </View>
            </View>
          </View>
        )}
        
        {createPlan.isError && (
          <View style={{ padding: 12, backgroundColor: palette.soft, borderRadius: 12, marginBottom: 16 }}>
            <Body muted>Planning is unavailable right now. Your saved progress is still here.</Body>
          </View>
        )}
        
        <ActionButton onPress={generatePlan} disabled={createPlan.isPending}>
          {createPlan.isPending ? <ActivityIndicator color="#FFFFFF" /> : plan ? 'Refresh plan' : 'Create my plan'}
        </ActionButton>
      </Card>
      
      <View style={{ marginTop: 32, marginBottom: 16 }}>
        <Eyebrow>Your path</Eyebrow>
        <Card padding={8}>
          <IconRow icon="book" title="Permit & knowledge" detail="Practice the handbook and revisit weak topics." />
          <View style={{ height: 1, backgroundColor: palette.border, marginLeft: 64 }} />
          <IconRow icon="car" title="Coached drive" detail="Use native location and camera features only when you choose." />
          <View style={{ height: 1, backgroundColor: palette.border, marginLeft: 64 }} />
          <IconRow icon="people" title="Parent conversation" detail="Review wins and choose one next step together." />
        </Card>
      </View>
      
      <View style={{ marginTop: 8, marginBottom: 24 }}>
        <Link href="/(tabs)/drive" asChild>
          <ActionButton onPress={() => undefined} secondary>Open drive coach</ActionButton>
        </Link>
      </View>
    </Screen>
  );
}
