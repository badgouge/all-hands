import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { SNIV_CATEGORY_LABEL, SNIV_STATUS_LABEL } from '../../src/domain/labels';
import { formatDateShort, formatMilitary, todayInZone } from '../../src/domain/time';
import type { SnivRequest } from '../../src/domain/types';
import { useTheme } from '../../src/ui/theme';
import { Note, PrimaryButton, Screen, Section } from '../../src/ui/ios';

export default function SnivelScreen() {
  const api = useAccountability();
  const router = useRouter();
  const { colors } = useTheme();
  if (!api.sailor) return null;
  const today = todayInZone(api.state.command.timezone, new Date());
  const mine = api.state.snivRequests.filter((request) => request.sailorId === api.sailor?.id);
  const upcoming = mine
    .filter((request) => isUpcoming(request, today))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const past = mine
    .filter((request) => !isUpcoming(request, today))
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));

  return (
    <Screen>
      <PrimaryButton label="Submit a Sniv Request" onPress={() => router.push('/request')} />
      <SnivGroup title="Upcoming" requests={upcoming} timeZone={api.state.command.timezone} empty="No upcoming snivs." colors={colors} />
      <SnivGroup title="Past" requests={past} timeZone={api.state.command.timezone} empty="No past snivs." colors={colors} />
    </Screen>
  );
}

export function isUpcoming(request: SnivRequest, today: string) {
  if (request.status === 'DENIED' || request.status === 'CANCELLED' || request.status === 'COMPLETED') return false;
  return request.endDate >= today;
}

function SnivGroup({
  title,
  requests,
  timeZone,
  empty,
  colors,
}: {
  title: string;
  requests: SnivRequest[];
  timeZone: string;
  empty: string;
  colors: { ink: string; muted: string; line: string; accent: string; accentText: string };
}) {
  return (
    <Section title={title}>
      {requests.length === 0 ? <Note>{empty}</Note> : requests.map((request, index) => (
        <View
          key={request.id}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: index === requests.length - 1 ? 0 : 1,
            borderBottomColor: colors.line,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600', flex: 1 }}>{SNIV_CATEGORY_LABEL[request.category]}</Text>
            {title === 'Upcoming' && index === 0 ? (
              <View style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: '700' }}>Next</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: colors.muted, fontSize: 15, marginTop: 3 }}>
            {formatDateShort(request.date, timeZone)} {formatMilitary(request.startTime)}–{formatMilitary(request.endTime)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 15, marginTop: 3 }}>
            {SNIV_STATUS_LABEL[request.status]}{request.categoryNote ? ` · ${request.categoryNote}` : ''}
          </Text>
        </View>
      ))}
    </Section>
  );
}
