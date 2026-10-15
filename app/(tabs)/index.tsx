import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { displayName } from '../../src/domain/labels';
import { familyCardModel, snivCardModel } from '../../src/domain/viewModels';
import { formatDateLong, todayInZone } from '../../src/domain/time';
import { MockNavyOrganizationService } from '../../src/organization';
import { CERTIFIER_ID, SAILOR_ID, SUPERVISOR_ID } from '../../src/data/seed';
import { hasRole } from '../../src/domain/accountability';
import { useTheme } from '../../src/ui/theme';
import { Screen } from '../../src/ui/ios';

const organization = new MockNavyOrganizationService();

export default function SplashScreen() {
  const api = useAccountability();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, dark, toggleDark } = useTheme();
  if (!api.sailor) return null;
  const supervisor = hasRole(api.sailor, 'SUPERVISOR');
  const certifier = hasRole(api.sailor, 'COMMAND_CERTIFIER');
  const now = new Date();
  const today = todayInZone(api.state.command.timezone, now);
  const family = familyCardModel(api.state, api.sailor);
  const sniv = snivCardModel(api.state, api.sailor, today);
  const organizationAttributes = organization.displayAttributes(api.sailor.id, today);
  const unread = api.state.notifications.filter((item) => item.recipientId === api.sailor?.id && !item.readAt).length;

  const cards = [
    { title: 'Muster', icon: 'checkmark-circle' as const, detail: formatDateLong(today, api.state.command.timezone), href: '/muster' as const },
    { title: 'Request Help', icon: 'medkit' as const, detail: 'Myself or a shipmate', href: '/help' as const },
    { title: 'Family', icon: 'people' as const, detail: `${family.count} dependents`, href: '/family' as const },
    {
      title: 'Snivel Log',
      icon: 'calendar' as const,
      detail: sniv.next ? `Next · ${sniv.next.label} · ${sniv.next.when}` : 'No upcoming sniv',
      href: '/snivel' as const,
    },
    ...(supervisor ? [{ title: 'Team', icon: 'people-circle' as const, detail: 'Work center muster and snivs', href: '/team' as const }] : []),
    ...(certifier ? [{ title: 'Command Certifier', icon: 'ribbon' as const, detail: 'Certify the command muster', href: '/command' as const }] : []),
  ];

  return (
    <Screen>
      <View style={{ backgroundColor: colors.header, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ color: colors.headerMuted, fontSize: 13, fontWeight: '600' }}>All Hands</Text>
        <Text style={{ color: colors.headerText, fontSize: 22, fontWeight: '700', marginTop: 4 }}>
          {displayName(api.sailor)}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Alerts" onPress={() => router.push('/alerts')} style={{ marginTop: 4 }}>
          <Text style={{ color: colors.headerMuted, fontWeight: '700' }}>{unread > 0 ? `Alerts · ${unread} new` : 'Alerts'}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 10, padding: 3, marginTop: 12 }}>
          <RoleButton label="Sailor" selected={api.sailor.id === SAILOR_ID} onPress={() => api.signIn(SAILOR_ID)} />
          <RoleButton label="Supervisor" selected={api.sailor.id === SUPERVISOR_ID} onPress={() => api.signIn(SUPERVISOR_ID)} />
          <RoleButton label="Command Certifier" selected={api.sailor.id === CERTIFIER_ID} onPress={() => api.signIn(CERTIFIER_ID)} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <Text style={{ color: colors.headerText, fontSize: 16, fontWeight: '600' }}>Dark mode</Text>
          <Switch
            accessibilityLabel="Dark mode"
            value={dark}
            onValueChange={toggleDark}
            trackColor={{ false: '#8A9BB5', true: '#FCE7A4' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
      <View style={{ marginTop: 16, marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }}>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '700' }}>Command Attributes</Text>
        </View>
        <View style={{ padding: 16, gap: 10 }}>
          {organizationAttributes.map((attribute) => (
            <View key={attribute.kind}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>{attribute.label}</Text>
              <Text style={{ color: colors.ink, fontSize: 16, marginTop: 2 }}>{attribute.value}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ marginTop: 16, marginHorizontal: 16, gap: 12 }}>
        {cards.map((card) => (
          <Pressable
            key={card.href}
            accessibilityRole="button"
            onPress={() => router.push(card.href)}
            style={({ pressed }) => ({
              backgroundColor: colors.card,
              borderRadius: 14,
              padding: 18,
              opacity: pressed ? 0.8 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#1a4480', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={card.icon} size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }}>{card.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 15, marginTop: 4 }}>{card.detail}</Text>
            </View>
            <Text style={{ color: colors.navy, fontSize: 22, fontWeight: '700' }}>›</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function RoleButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: selected ? colors.headerText : 'transparent',
      }}
    >
      <Text style={{ color: selected ? colors.header : colors.headerText, fontWeight: '700', fontSize: 12, textAlign: 'center', lineHeight: 15 }}>{label}</Text>
    </Pressable>
  );
}
