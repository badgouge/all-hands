import { Pressable, Text, StyleSheet } from 'react-native';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { formatTimestamp } from '../../src/domain/time';
import { colors } from '../../src/ui/theme';
import { Screen } from '../../src/ui/ios';

export default function AlertsScreen() {
  const api = useAccountability();
  if (!api.sailor) return null;
  const notes = api.state.notifications.filter((item) => item.recipientId === api.sailor?.id);

  return (
    <Screen>
      <Text style={styles.title}>Alerts</Text>
      {notes.length === 0 ? <Text style={styles.empty}>No alerts.</Text> : notes.map((item) => (
        <Pressable key={item.id} style={styles.row} onPress={() => api.markNotificationRead(item.id)}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.when}>{formatTimestamp(item.createdAt, api.state.command.timezone)}{item.readAt ? '' : ' · New'}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 16, marginHorizontal: 20, fontSize: 28, fontWeight: '700', color: colors.ink },
  empty: { margin: 20, color: colors.muted, fontSize: 16 },
  row: { marginHorizontal: 16, marginTop: 12, backgroundColor: colors.card, borderRadius: 12, padding: 16 },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: '600' },
  body: { color: colors.ink, fontSize: 15, marginTop: 4 },
  when: { color: colors.muted, fontSize: 13, marginTop: 6 },
});
