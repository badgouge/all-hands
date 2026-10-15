import { Pressable, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { usePalette } from '../../src/ui/theme';

function AllHandsBack() {
  const colors = usePalette();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="All Hands"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 6 }}
    >
      <Text style={{ color: colors.ink, fontSize: 28, lineHeight: 30 }}>‹</Text>
      <Text style={{ color: colors.ink, fontSize: 17, marginLeft: 2 }}>All Hands</Text>
    </Pressable>
  );
}

export default function ModuleLayout() {
  const colors = usePalette();
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.ink,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.ink },
        headerBackButtonDisplayMode: 'default',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="muster" options={{ title: 'Muster', headerBackTitle: 'All Hands' }} />
      <Stack.Screen name="help" options={{ title: 'Request Help', headerBackTitle: 'All Hands' }} />
      <Stack.Screen name="family" options={{ title: 'Family', headerBackTitle: 'All Hands' }} />
      <Stack.Screen name="snivel" options={{ title: 'Snivel Log', headerBackTitle: 'All Hands' }} />
      <Stack.Screen name="team" options={{ title: 'Team', headerBackTitle: 'All Hands' }} />
      <Stack.Screen
        name="command"
        options={{
          title: 'Command Certifier',
          headerBackVisible: false,
          headerLeft: () => <AllHandsBack />,
        }}
      />
      <Stack.Screen name="settings" options={{ title: 'Work center', headerBackTitle: 'Team' }} />
      <Stack.Screen name="alerts" options={{ title: 'Alerts', headerBackTitle: 'All Hands' }} />
      <Stack.Screen name="member/[sailorId]" options={{ title: 'Sailor', headerBackTitle: 'Team' }} />
    </Stack>
  );
}
