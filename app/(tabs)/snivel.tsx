import { Pressable, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { SNIV_CATEGORY_LABEL, SNIV_STATUS_LABEL } from '../../src/domain/labels';
import { formatDateShort, formatMilitary, todayInZone } from '../../src/domain/time';
import { colors } from '../../src/ui/theme';
import { PrimaryButton, Screen, Section } from '../../src/ui/ios';

export default function SnivelScreen() {
  const api = useAccountability();
  const router = useRouter();
  if (!api.sailor) return null;
  const today = todayInZone(api.state.command.timezone, new Date());
  const mine = api.state.snivRequests
    .filter((request) => request.sailorId === api.sailor?.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen>
      <PrimaryButton label="Request time away" onPress={() => router.push('/request')} />
      <Section title="Snivel Log">
        {mine.length === 0 ? <Text style={styles.empty}>No requests yet.</Text> : mine.map((request) => (
          <Pressable key={request.id} style={styles.row}>
            <Text style={styles.title}>{SNIV_CATEGORY_LABEL[request.category]}</Text>
            <Text style={styles.detail}>
              {formatDateShort(request.date, api.state.command.timezone)} {formatMilitary(request.startTime)}–{formatMilitary(request.endTime)}
            </Text>
            <Text style={styles.detail}>{SNIV_STATUS_LABEL[request.status]}{request.endDate < today && request.status === 'APPROVED' ? '' : ''}</Text>
          </Pressable>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { padding: 16, color: colors.muted, fontSize: 16 },
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  title: { color: colors.ink, fontSize: 17, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 15, marginTop: 3 },
});
