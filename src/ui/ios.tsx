import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from './theme';

export function Screen({ children }: { children: ReactNode }) {
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>{children}</ScrollView>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

export function Row({ title, detail, last }: { title: string; detail?: string | null; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowTitle}>{title}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, selected && styles.choiceOn]}>
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 32 },
  section: { marginTop: 22 },
  sectionTitle: { marginHorizontal: 20, marginBottom: 8, color: colors.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  group: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' },
  row: { paddingHorizontal: 16, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowTitle: { color: colors.ink, fontSize: 17, fontWeight: '600' },
  rowDetail: { color: colors.muted, fontSize: 15, marginTop: 4 },
  button: { marginHorizontal: 16, marginTop: 16, minHeight: 50, borderRadius: 12, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  buttonLabel: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  choice: { marginHorizontal: 16, marginTop: 8, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, justifyContent: 'center', paddingHorizontal: 16 },
  choiceOn: { borderColor: colors.navy, backgroundColor: colors.fill },
  choiceLabel: { color: colors.ink, fontSize: 16 },
  choiceLabelOn: { color: colors.navy, fontWeight: '700' },
});
