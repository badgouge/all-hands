import { Stack } from 'expo-router';
import { usePalette } from '../../src/ui/theme';

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
      <Stack.Screen name="command" options={{ title: 'Command Certifier', headerBackTitle: 'All Hands', headerBackButtonDisplayMode: 'minimal' }} />
      <Stack.Screen name="settings" options={{ title: 'Work center', headerBackTitle: 'Team' }} />
      <Stack.Screen name="alerts" options={{ title: 'Alerts', headerBackTitle: 'All Hands' }} />
      <Stack.Screen name="member/[sailorId]" options={{ title: 'Sailor', headerBackTitle: 'Team' }} />
    </Stack>
  );
}
