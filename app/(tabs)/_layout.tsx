import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { rosterScope } from '../../src/domain/accountability';
import { displayName } from '../../src/domain/labels';
import { SAILOR_ID, SUPERVISOR_ID } from '../../src/data/seed';
import { colors } from '../../src/ui/theme';

export default function TabLayout() {
  const api = useAccountability();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supervisor = api.sailor ? rosterScope(api.sailor) !== 'NONE' : false;
  const unread = api.state.notifications.filter((item) => item.recipientId === api.sailor?.id && !item.readAt).length;

  function switchRole(sailorId: string, path: '/team' | '/') {
    if (api.sailor?.id !== sailorId) api.signIn(sailorId);
    router.replace(path);
  }

  return (
    <View style={styles.shell}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.kicker}>Accountability</Text>
        <Text style={styles.name}>{api.sailor ? displayName(api.sailor) : ''}</Text>
        <View style={styles.segment} accessibilityRole="tablist">
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: api.sailor?.id === SAILOR_ID }}
            style={[styles.segmentButton, api.sailor?.id === SAILOR_ID && styles.segmentOn]}
            onPress={() => switchRole(SAILOR_ID, '/')}
          >
            <Text style={[styles.segmentLabel, api.sailor?.id === SAILOR_ID && styles.segmentLabelOn]}>Sailor</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: api.sailor?.id === SUPERVISOR_ID }}
            style={[styles.segmentButton, api.sailor?.id === SUPERVISOR_ID && styles.segmentOn]}
            onPress={() => switchRole(SUPERVISOR_ID, '/team')}
          >
            <Text style={[styles.segmentLabel, api.sailor?.id === SUPERVISOR_ID && styles.segmentLabelOn]}>Supervisor</Text>
          </Pressable>
        </View>
      </View>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.navy,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="muster"
          options={{ title: 'Muster', tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="family"
          options={{ title: 'Family', tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="snivel"
          options={{ title: 'Snivel Log', tabBarIcon: ({ color, size }) => <Ionicons name="time" color={color} size={size} /> }}
        />
        <Tabs.Screen
          name="team"
          options={{
            title: 'Team',
            href: supervisor ? '/team' : null,
            tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="alerts"
          options={{
            title: 'Alerts',
            tabBarBadge: unread > 0 ? unread : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name="notifications" color={color} size={size} />,
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.navy, paddingHorizontal: 16, paddingBottom: 12 },
  kicker: { color: '#D9E2F1', fontSize: 13, fontWeight: '600' },
  name: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 2 },
  segment: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 10, padding: 3, marginTop: 12 },
  segmentButton: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentOn: { backgroundColor: '#FFFFFF' },
  segmentLabel: { color: '#FFFFFF', fontWeight: '700' },
  segmentLabelOn: { color: colors.navy },
});
