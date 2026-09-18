import { Link } from 'expo-router';
import { Text, View, Pressable } from 'react-native';
import { Body, Card, Eyebrow, IconRow, Screen, Title, usePalette } from '@/components/ui';
import { useCoastwise } from '@/lib/coastwise-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export default function ParentScreen() {
  const palette = usePalette();
  const { drives, plan } = useCoastwise();
  const lastDrive = drives[0];
  
  return (
    <Screen>
      <View style={{ marginTop: 12, marginBottom: 24 }}>
        <Eyebrow>Parent view</Eyebrow>
        <Title large>Keep practice calm and specific.</Title>
        <Body muted>Coastwise keeps drive media and precise locations on the driver’s device. Use this view to talk through progress while parked.</Body>
      </View>

      <Card padding={24}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="time" size={24} color={palette.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Eyebrow>Recent practice</Eyebrow>
            <Title>Latest session</Title>
          </View>
        </View>
        
        {lastDrive ? (
          <View>
            <Text style={{ color: palette.text, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 4 }}>{lastDrive.durationMinutes} min</Text>
            <Body muted>{lastDrive.night ? 'Night drive' : 'Day drive'} · {lastDrive.distanceMiles.toFixed(1)} miles</Body>
            
            {lastDrive.debrief && (
              <View style={{ marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: palette.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>Focus</Text>
                </View>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: 8, lineHeight: 24 }}>{lastDrive.debrief.headline}</Text>
                <Text style={{ color: palette.text, fontSize: 15, lineHeight: 22 }}>{lastDrive.debrief.nextStep}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ color: palette.muted, textAlign: 'center', fontSize: 15 }}>No saved drives yet. Start a supervised drive when you are parked and ready.</Text>
          </View>
        )}
      </Card>

      {plan && (
        <Card accent padding={24}>
          <Eyebrow>Next drive plan</Eyebrow>
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <Ionicons name="flag" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 18, fontWeight: '800', marginBottom: 4 }}>{plan.skillFocus}</Text>
                <Text style={{ color: palette.muted, fontSize: 14 }}>{plan.durationMinutes} minutes · {plan.safetyGuidance}</Text>
              </View>
            </View>
            <View style={{ backgroundColor: palette.soft, padding: 16, borderRadius: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Ionicons name="chatbubbles" size={20} color={palette.text} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 15, lineHeight: 22, fontWeight: '500' }}>{plan.parentPrompt}</Text>
              </View>
            </View>
          </View>
        </Card>
      )}

      <View style={{ marginTop: 24 }}>
        <Card padding={8}>
          <View style={{ padding: 16, paddingBottom: 4 }}>
            <Eyebrow>Safety boundary</Eyebrow>
          </View>
          <IconRow icon="hand-left" title="Park before reviewing" detail="The supervising adult handles setup and conversation. Never interact with Coastwise while moving." />
          <View style={{ height: 1, backgroundColor: palette.border, marginLeft: 64 }} />
          <IconRow icon="lock-closed" title="Local by default" detail="Videos, precise routes, notes, and coaching positions are not included in AI summaries." />
        </Card>
      </View>

      <Link href="/privacy" asChild>
        <Pressable style={({ pressed }) => [{ marginTop: 32, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.7 : 1 }]}>
          <Ionicons name="shield-checkmark" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>Review privacy details</Text>
        </Pressable>
      </Link>
    </Screen>
  );
}
