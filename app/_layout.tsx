import { ActivityIndicator, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountabilityProvider, useAccountability } from '../src/app/state/AccountabilityProvider';
import { readPersisted, setAppWriter, STORAGE_KEY, type PersistedApp } from '../src/services/storage';
import { ThemeProvider, useTheme } from '../src/ui/theme';

export default function RootLayout() {
  const [initialApp, setInitialApp] = useState<PersistedApp | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled) return;
      setAppWriter((value) => {
        void AsyncStorage.setItem(STORAGE_KEY, value);
      });
      setInitialApp(readPersisted(raw));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ThemeProvider>
      {initialApp ? <AppShell initialApp={initialApp} /> : <Boot />}
    </ThemeProvider>
  );
}

function ConfirmationToast() {
  const api = useAccountability();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!api.flash) return;
    setText(api.flash);
    const timer = setTimeout(() => {
      setText(null);
      api.clearFlash();
    }, 2800);
    return () => clearTimeout(timer);
  }, [api.notice]);

  if (!text) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, backgroundColor: '#157A32', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}

function Boot() {
  const { colors, dark } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.navy} />
      <StatusBar style={dark ? 'light' : 'dark'} />
    </View>
  );
}

function AppShell({ initialApp }: { initialApp: PersistedApp }) {
  const { colors, dark } = useTheme();
  return (
    <AccountabilityProvider initialApp={initialApp}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
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
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="history" options={{ title: 'Muster history', headerBackTitle: 'Muster' }} />
        <Stack.Screen name="request" options={{ title: 'Submit A Sniv Request', headerBackTitle: 'Snivel Log' }} />
      </Stack>
      <ConfirmationToast />
      </View>
    </AccountabilityProvider>
  );
}
