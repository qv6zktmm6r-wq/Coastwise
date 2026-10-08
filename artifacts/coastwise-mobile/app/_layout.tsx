import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setBaseUrl } from '@workspace/api-client-react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CoastwiseProvider } from '@/lib/coastwise-context';
import { loadCoachCameras } from '@/lib/native-vision';

// Worklets initialize with a synchronous UI-thread call on first import, which
// deadlocks if it first happens while a screen is mounting.
loadCoachCameras();

const queryClient = new QueryClient();
const apiDomain = process.env.EXPO_PUBLIC_DOMAIN;
if (apiDomain) setBaseUrl(`https://${apiDomain}`);

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <CoastwiseProvider>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false }} />
        </CoastwiseProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}