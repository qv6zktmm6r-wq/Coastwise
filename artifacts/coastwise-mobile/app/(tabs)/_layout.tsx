import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { colors } from '@/theme';

export default function TabLayout() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: dark ? colors.dark.muted : colors.light.muted,
        tabBarStyle: {
          backgroundColor: dark ? colors.dark.card : colors.light.card,
          borderTopColor: dark ? colors.dark.border : colors.light.border,
          height: 88,
          paddingBottom: 32,
          paddingTop: 12,
          elevation: 0,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="sunny" color={color} size={26} /> }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice', tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={26} /> }} />
      <Tabs.Screen name="drive" options={{ title: 'Drive', tabBarIcon: ({ color, size }) => <Ionicons name="car" color={color} size={28} /> }} />
      <Tabs.Screen name="parent" options={{ title: 'Parent', tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={26} /> }} />
    </Tabs>
  );
}
