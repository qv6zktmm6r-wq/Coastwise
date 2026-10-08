import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Body, Card, Eyebrow, Screen, Title, usePalette } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export default function PrivacyScreen() {
  const palette = usePalette();
  const router = useRouter();
  
  return (
    <Screen>
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 24, opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="chevron-back" size={24} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>Back</Text>
      </Pressable>
      
      <View style={{ marginBottom: 32 }}>
        <Eyebrow>Coastwise privacy</Eyebrow>
        <Title large>Your progress stays yours.</Title>
        <Body muted>Coastwise is designed for local-first supervised practice.</Body>
      </View>
      
      <View style={{ gap: 16 }}>
        <Card padding={24}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="phone-portrait" size={20} color={palette.text} />
            </View>
            <Eyebrow style={{ marginBottom: 0 }}>On this device</Eyebrow>
          </View>
          <Body>Drive video, precise route details, coaching positions, recordings, and family notes stay in app storage on this device. If you choose a retention period, older recordings are deleted automatically while drive summaries remain.</Body>
        </Card>
        
        <Card padding={24}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="sparkles" size={20} color={colors.primary} />
            </View>
            <Eyebrow style={{ marginBottom: 0, color: colors.primary }}>Optional AI</Eyebrow>
          </View>
          <Body>If you choose Generate private debrief, Coastwise sends only duration, distance, night status, selected skills, coach-event text, and up to three low-mastery topics to the managed AI service. Video, routes, coordinates, speeds, identity, notes, recording metadata, and raw answers are excluded.</Body>
        </Card>
        
        <Card padding={24}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${palette.success}18`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="share" size={20} color={palette.success} />
            </View>
            <Eyebrow style={{ marginBottom: 0, color: palette.success }}>Export & Sharing</Eyebrow>
          </View>
          <Body>Family summaries contain only weekly totals, practiced skills, goal status, and dates. They never include recordings, exact routes, coordinates, AI debrief text, or metadata. DMV exports are plain CSV files for your personal records only.</Body>
        </Card>

        <Card padding={24}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${palette.warning}18`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="car" size={20} color={palette.warning} />
            </View>
            <Eyebrow style={{ marginBottom: 0, color: palette.warning }}>While driving</Eyebrow>
          </View>
          <Body>Location is used only during an active foreground coaching session. Do not interact with Coastwise while the vehicle is moving. A supervising adult remains responsible for safe and legal practice.</Body>
        </Card>

        <Card padding={24}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: palette.soft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="map" size={20} color={palette.text} />
            </View>
            <Eyebrow style={{ marginBottom: 0 }}>Optional map coaching</Eyebrow>
          </View>
          <Body>If you turn on map coaching, Coastwise downloads OpenStreetMap stop signs and speed limits for the roughly 2 km square you are driving in. The request names only that square, never your exact position or route, and is sent to the public OpenStreetMap Overpass service. Map data can be missing or out of date, so cues always say they come from the map.</Body>
        </Card>
      </View>
      
      <Pressable onPress={() => router.back()} accessibilityRole="button" style={({ pressed }) => [{ marginTop: 32, alignItems: 'center', justifyContent: 'center', minHeight: 56, backgroundColor: palette.soft, borderRadius: 18, opacity: pressed ? 0.7 : 1 }]}>
        <Text style={{ color: palette.text, fontWeight: '800', fontSize: 16 }}>Done</Text>
      </Pressable>
      
      <Text style={{ color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: 32, marginBottom: 24, textAlign: 'center' }}>
        Privacy policy version: September 18, 2026{'\n'}Mobile companion draft
      </Text>
    </Screen>
  );
}
