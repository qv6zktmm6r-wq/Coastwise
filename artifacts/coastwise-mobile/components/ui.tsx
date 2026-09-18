import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { colors } from '@/theme';
import { useRef, useCallback } from 'react';

export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return dark ? colors.dark : colors.light;
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const content = <View style={[styles.container, { backgroundColor: palette.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 100 }]}>{children}</View>;
  return scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content;
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: any }) {
  return <Text style={[styles.eyebrow, { color: colors.primary }, style]}>{children}</Text>;
}

export function Title({ children, large = false }: { children: ReactNode; large?: boolean }) {
  const palette = usePalette();
  return <Text style={[large ? styles.titleLarge : styles.title, { color: palette.text }]}>{children}</Text>;
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const palette = usePalette();
  return <Text style={[styles.body, { color: muted ? palette.muted : palette.text }]}>{children}</Text>;
}

export function Card({ children, accent = false, padding = 20 }: { children: ReactNode; accent?: boolean; padding?: number }) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.card, borderColor: accent ? `${colors.primary}44` : palette.border, padding }]}>{children}</View>;
}

export function ActionButton({ children, onPress, secondary = false, destructive = false, disabled = false, selected }: { children: ReactNode; onPress: () => void; secondary?: boolean; destructive?: boolean; disabled?: boolean; selected?: boolean }) {
  const palette = usePalette();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  }, [scale]);

  const bgColor = secondary ? 'transparent' : destructive ? palette.destructive : colors.primary;
  const borderColor = destructive ? palette.destructive : secondary ? palette.border : colors.primary;
  const textColor = secondary ? destructive ? palette.destructive : palette.text : '#FFFFFF';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      {({ pressed }) => (
        <Animated.View style={[
          styles.button,
          { 
            backgroundColor: bgColor, 
            borderColor: borderColor, 
            opacity: disabled ? 0.5 : pressed && secondary ? 0.7 : 1,
            transform: [{ scale }]
          }
        ]}>
          <Text style={[styles.buttonText, { color: textColor }]}>{children}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

export function IconRow({ icon, title, detail, accent = false }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; accent?: boolean }) {
  const palette = usePalette();
  return (
    <View style={styles.iconRow}>
      <View style={[styles.iconCircle, { backgroundColor: accent ? `${colors.primary}18` : palette.soft }]}>
        <Ionicons name={icon} size={22} color={accent ? colors.primary : palette.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: palette.text }]}>{title}</Text>
        <Text style={[styles.rowDetail, { color: palette.muted }]}>{detail}</Text>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 },
  titleLarge: { fontSize: 40, lineHeight: 46, fontWeight: '800', letterSpacing: -1.2, marginBottom: 12 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6, marginBottom: 10 },
  body: { fontSize: 16, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: 24, marginTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  button: { minHeight: 56, borderWidth: 1, borderRadius: 18, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  buttonText: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  iconRow: { flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 12 },
  iconCircle: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  rowTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  rowDetail: { fontSize: 14, lineHeight: 20, marginTop: 4 },
});
