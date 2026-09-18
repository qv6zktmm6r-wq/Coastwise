import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, View, useColorScheme, type ReactNode } from 'react-native';
import { colors } from '@/theme';

export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return dark ? colors.dark : colors.light;
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const content = <View style={[styles.container, { backgroundColor: palette.background, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}>{children}</View>;
  return scroll ? <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <Text style={[styles.eyebrow, { color: colors.primary }]}>{children}</Text>;
}

export function Title({ children, large = false }: { children: ReactNode; large?: boolean }) {
  const palette = usePalette();
  return <Text style={[large ? styles.titleLarge : styles.title, { color: palette.text }]}>{children}</Text>;
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const palette = usePalette();
  return <Text style={[styles.body, { color: muted ? palette.muted : palette.text }]}>{children}</Text>;
}

export function Card({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  const palette = usePalette();
  return <View style={[styles.card, { backgroundColor: palette.card, borderColor: accent ? `${colors.primary}55` : palette.border }]}>{children}</View>;
}

export function ActionButton({ children, onPress, secondary = false, disabled = false }: { children: ReactNode; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? 'transparent' : colors.primary, borderColor: secondary ? colors.primary : colors.primary, opacity: disabled ? 0.55 : pressed ? 0.8 : 1 }]}><Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{children}</Text></Pressable>;
}

export function IconRow({ icon, title, detail }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }) {
  const palette = usePalette();
  return <View style={styles.iconRow}><View style={[styles.iconCircle, { backgroundColor: palette.soft }]}><Ionicons name={icon} size={20} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: palette.text }]}>{title}</Text><Text style={[styles.rowDetail, { color: palette.muted }]}>{detail}</Text></View></View>;
}

export const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  titleLarge: { fontSize: 36, lineHeight: 40, fontWeight: '800', letterSpacing: -1.1, marginBottom: 10 },
  title: { fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 20, padding: 18, marginTop: 14 },
  button: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  iconRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10 },
  iconCircle: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowDetail: { fontSize: 13, lineHeight: 19, marginTop: 2 },
});