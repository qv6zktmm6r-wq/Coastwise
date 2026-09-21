import { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, Body, Card, Eyebrow, Screen, Title, usePalette, IconRow } from '@/components/ui';
import { useCoastwise } from '@/lib/coastwise-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export default function OnboardingScreen() {
  const palette = usePalette();
  const router = useRouter();
  const { setRole, setJurisdiction, completeOnboarding, acknowledgePrivacy } = useCoastwise();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<'teen' | 'parent' | null>(null);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<'US-CA' | null>(null);

  const handleNext = () => {
    if (step === 1 && selectedRole) {
      setRole(selectedRole);
      setStep(2);
    } else if (step === 2 && selectedJurisdiction) {
      setJurisdiction(selectedJurisdiction);
      setStep(3);
    } else if (step === 3) {
      acknowledgePrivacy();
      completeOnboarding();
      router.replace('/(tabs)');
    }
  };

  return (
    <Screen scroll={true}>
      <View style={{ flex: 1, paddingBottom: 40, marginTop: 40 }}>
        {step === 1 ? (
          <>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Ionicons name="car" size={32} color={colors.primary} />
            </View>
            <Eyebrow>Welcome</Eyebrow>
            <Title large>Who is using this device?</Title>
            <Body muted>Coastwise helps teens and adults practice driving safely together.</Body>

            <View style={{ marginTop: 32, gap: 16 }}>
              <ActionButton 
                secondary={selectedRole !== 'teen'} 
                onPress={() => setSelectedRole('teen')}
                selected={selectedRole === 'teen'}
              >
                I am learning to drive
              </ActionButton>
              <ActionButton 
                secondary={selectedRole !== 'parent'} 
                onPress={() => setSelectedRole('parent')}
                selected={selectedRole === 'parent'}
              >
                I am coaching a teen
              </ActionButton>
            </View>
          </>
        ) : step === 2 ? (
          <>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Ionicons name="map" size={32} color={colors.primary} />
            </View>
            <Eyebrow>Choose your state</Eyebrow>
            <Title large>Which rules should guide your practice?</Title>
            <Body muted>Select a state manually. Location is never used to infer your jurisdiction.</Body>
            <View style={{ marginTop: 32, gap: 16 }}>
              <ActionButton secondary={selectedJurisdiction !== 'US-CA'} selected={selectedJurisdiction === 'US-CA'} onPress={() => setSelectedJurisdiction('US-CA')}>
                California (US-CA)
              </ActionButton>
              <Body muted>Texas and Florida packs are installed but remain unavailable until their human source-matrix reviews are approved.</Body>
            </View>
          </>
        ) : (
          <>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
            </View>
            <Eyebrow>Privacy First</Eyebrow>
            <Title large>Your data stays yours.</Title>
            <Body muted>Coastwise requires no account. Practice videos, locations, and driving notes are stored safely on this device.</Body>

            <View style={{ marginTop: 32, gap: 16 }}>
              <Card accent padding={24}>
                <IconRow icon="lock-closed" title="Local storage" detail="Drive data stays on this device unless you share it." />
                <View style={{ height: 1, backgroundColor: palette.border, marginVertical: 8, marginLeft: 64 }} />
                <IconRow icon="shield-checkmark" title="Optional AI" detail="Debriefs only use anonymized durations and topics." />
              </Card>
              <Card padding={24}>
                <IconRow icon="hand-left" title="Permissions later" detail="We will ask for location or camera only when you try to use them." />
              </Card>
            </View>
          </>
        )}

        <View style={{ marginTop: 'auto', paddingTop: 40 }}>
          <ActionButton 
            onPress={handleNext} 
            disabled={(step === 1 && !selectedRole) || (step === 2 && !selectedJurisdiction)}
          >
            {step === 1 || step === 2 ? 'Continue' : 'Start practicing'}
          </ActionButton>
        </View>
      </View>
    </Screen>
  );
}