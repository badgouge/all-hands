import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountabilityProvider } from '../src/app/state/AccountabilityProvider';
import { readPersisted, setAppWriter, STORAGE_KEY, type PersistedApp } from '../src/services/storage';
import { colors } from '../src/ui/theme';

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

  if (!initialApp) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.navy} />
        <StatusBar style="dark" />
      </View>
    );
  }

  return (
    <AccountabilityProvider initialApp={initialApp}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerTintColor: colors.navy,
          headerTitleStyle: { color: colors.ink },
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="history" options={{ title: 'Muster history', headerBackTitle: 'Muster' }} />
        <Stack.Screen name="request" options={{ title: 'Request time away', headerBackTitle: 'Snivel Log' }} />
      </Stack>
    </AccountabilityProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
