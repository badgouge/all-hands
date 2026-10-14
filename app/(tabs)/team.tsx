import { useState } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { rosterScope } from '../../src/domain/accountability';
import { workCenterQueue } from '../../src/domain/viewModels';
import { colors } from '../../src/ui/theme';
import { PrimaryButton, Screen } from '../../src/ui/ios';

const trackColor = {
  Ready: colors.gold,
  Confirmed: colors.green,
  'Not mustered': colors.muted,
  Held: colors.red,
} as const;

export default function TeamScreen() {
  const api = useAccountability();
  const [message, setMessage] = useState<string | null>(null);
  if (!api.sailor) return null;
  if (rosterScope(api.sailor) === 'NONE') {
    return (
      <Screen>
        <Text style={styles.note}>Switch to Supervisor to approve the work center.</Text>
      </Screen>
    );
  }
  const members = workCenterQueue(api.state, api.sailor, new Date(), api.settings.forceDutyDay);
  const ready = members.filter((member) => member.track === 'Ready').length;
  const pending = members.reduce((sum, member) => sum + member.pendingSnivs, 0);

  return (
    <Screen>
      <Text style={styles.title}>Work center</Text>
      <Text style={styles.note}>
        {members.length} Sailors tracked. {ready} muster{ready === 1 ? '' : 's'} ready. {pending} snivel request{pending === 1 ? '' : 's'} pending.
      </Text>
      <View style={styles.group}>
        {members.map((member, index) => (
          <View key={member.sailorId} style={[styles.row, index < members.length - 1 && styles.border]}>
            <View style={styles.rowText}>
              <Text style={styles.name}>{member.name}</Text>
              <Text style={styles.detail}>{member.musterLabel}</Text>
              {member.pendingSnivs > 0 ? (
                <Text style={styles.detail}>{member.pendingSnivs} snivel request{member.pendingSnivs === 1 ? '' : 's'} in queue</Text>
              ) : null}
            </View>
            <Text style={[styles.track, { color: trackColor[member.track] }]}>{member.track}</Text>
          </View>
        ))}
      </View>
      <PrimaryButton
        label="Approve work center"
        onPress={() => {
          const result = api.approveWorkCenter();
          setMessage(result.ok ? result.message : result.error);
        }}
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 16, marginHorizontal: 20, fontSize: 28, fontWeight: '700', color: colors.ink },
  note: { marginTop: 8, marginHorizontal: 20, color: colors.muted, fontSize: 16, lineHeight: 22 },
  group: { marginTop: 16, marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowText: { flex: 1 },
  name: { color: colors.ink, fontSize: 17, fontWeight: '600' },
  detail: { color: colors.muted, fontSize: 15, marginTop: 3 },
  track: { fontSize: 13, fontWeight: '700' },
  message: { marginHorizontal: 20, marginTop: 12, color: colors.ink, fontSize: 16, lineHeight: 22 },
});
