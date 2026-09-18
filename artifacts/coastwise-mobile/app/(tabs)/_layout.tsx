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
        tabBarInactiveTintColor: dark ? '#8493A3' : '#738092',
        tabBarStyle: {
          backgroundColor: dark ? colors.dark.card : colors.light.card,
          borderTopColor: dark ? colors.dark.border : colors.light.border,
          height: 84,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="sunny-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="practice" options={{ title: 'Practice', tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="drive" options={{ title: 'Drive', tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="parent" options={{ title: 'Parent', tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}