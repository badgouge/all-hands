import { Pressable, Text } from 'react-native';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { formatTimestamp } from '../../src/domain/time';
import { useTheme } from '../../src/ui/theme';
import { Note, Screen } from '../../src/ui/ios';

export default function AlertsScreen() {
  const api = useAccountability();
  const { colors } = useTheme();
  if (!api.sailor) return null;
  const notes = api.state.notifications.filter((item) => item.recipientId === api.sailor?.id);

  return (
    <Screen>
      {notes.length === 0 ? <Note>No alerts.</Note> : notes.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => api.markNotificationRead(item.id)}
          style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: colors.card, borderRadius: 12, padding: 16 }}
        >
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>{item.title}</Text>
          <Text style={{ color: colors.muted, fontSize: 15, marginTop: 4 }}>{item.body}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
            {formatTimestamp(item.createdAt, api.state.command.timezone)}{item.readAt ? '' : ' · New'}
          </Text>
        </Pressable>
      ))}
    </Screen>
  );
}
