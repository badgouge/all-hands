import { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAccountability } from '../../../src/app/state/AccountabilityProvider';
import { displayName, SNIV_CATEGORY_LABEL, SNIV_STATUS_LABEL } from '../../../src/domain/labels';
import { formatDateShort, formatMilitary, todayInZone } from '../../../src/domain/time';
import type { SnivRequest } from '../../../src/domain/types';
import { useTheme } from '../../../src/ui/theme';
import { Note, PrimaryButton, Screen, Section } from '../../../src/ui/ios';
import { isUpcoming } from '../snivel';

export default function MemberScreen() {
  const { sailorId } = useLocalSearchParams<{ sailorId: string }>();
  const api = useAccountability();
  const { colors } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const sailor = api.state.sailors.find((item) => item.id === sailorId);
  if (!api.sailor || !sailor) {
    return (
      <Screen>
        <Note>Sailor not found.</Note>
      </Screen>
    );
  }

  const today = todayInZone(api.state.command.timezone, new Date());
  const requests = api.state.snivRequests.filter((request) => request.sailorId === sailor.id);
  const upcoming = requests.filter((request) => isUpcoming(request, today)).sort((a, b) => a.date.localeCompare(b.date));
  const past = requests.filter((request) => !isUpcoming(request, today)).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen>
      <Stack.Screen options={{ title: displayName(sailor) }} />
      <Group title="Upcoming" requests={upcoming} timeZone={api.state.command.timezone} colors={colors} onApprove={(id) => {
        const result = api.approveSniv(id);
        setMessage(result.ok ? result.message : result.error);
      }} />
      <Group title="Past" requests={past} timeZone={api.state.command.timezone} colors={colors} onApprove={(id) => {
        const result = api.approveSniv(id);
        setMessage(result.ok ? result.message : result.error);
      }} />
      {message ? <Note>{message}</Note> : null}
    </Screen>
  );
}

function Group({
  title,
  requests,
  timeZone,
  colors,
  onApprove,
}: {
  title: string;
  requests: SnivRequest[];
  timeZone: string;
  colors: { ink: string; muted: string; line: string };
  onApprove: (id: string) => void;
}) {
  return (
    <Section title={title}>
      {requests.length === 0 ? <Note>None.</Note> : requests.map((request) => (
        <View key={request.id} style={{ paddingHorizontal: 16, paddingTop: 14, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>{SNIV_CATEGORY_LABEL[request.category]}</Text>
          <Text style={{ color: colors.muted, fontSize: 15, marginTop: 3 }}>
            {formatDateShort(request.date, timeZone)} {formatMilitary(request.startTime)}–{formatMilitary(request.endTime)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 15, marginTop: 3 }}>{SNIV_STATUS_LABEL[request.status]}</Text>
          {request.remarks ? <Text style={{ color: colors.muted, fontSize: 15, marginTop: 3 }}>{request.remarks}</Text> : null}
          {request.status === 'PENDING_APPROVAL' ? (
            <View style={{ marginBottom: 8, marginHorizontal: -16 }}>
              <PrimaryButton label="Approve" onPress={() => onApprove(request.id)} />
            </View>
          ) : <View style={{ height: 14 }} />}
        </View>
      ))}
    </Section>
  );
}
