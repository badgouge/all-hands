import { useAccountability } from '../../app/state/AccountabilityProvider';
import { NotificationCenter } from '../components/NotificationCenter';
import { Screen } from '../components/Screen';

export function NotificationPage() {
  const api = useAccountability();
  if (!api.sailor) return null;
  const items = api.state.notifications.filter((item) => item.recipientId === api.sailor?.id);
  return (
    <Screen>
      <h1>Notifications</h1>
      <NotificationCenter
        items={items}
        timeZone={api.state.command.timezone}
        onOpen={(id) => api.markNotificationRead(id)}
        onMarkAll={api.markAllNotificationsRead}
      />
    </Screen>
  );
}
