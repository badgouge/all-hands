import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { THEME_KEY } from '../services/storage';

export interface Palette {
  navy: string;
  ink: string;
  muted: string;
  background: string;
  card: string;
  line: string;
  green: string;
  gold: string;
  blue: string;
  red: string;
  fill: string;
  header: string;
  headerText: string;
  headerMuted: string;
  onAccent: string;
  accent: string;
  accentText: string;
}

export const lightColors: Palette = {
  navy: '#1a4480',
  ink: '#1b1b1b',
  muted: '#565c65',
  background: '#F2F2F7',
  card: '#FFFFFF',
  line: '#E5E5EA',
  green: '#0E7C28',
  gold: '#8A5A00',
  blue: '#005EA2',
  red: '#B50909',
  fill: '#E8EEF6',
  header: '#1a4480',
  headerText: '#FFFFFF',
  headerMuted: '#D9E2F1',
  onAccent: '#FFFFFF',
  accent: '#1a4480',
  accentText: '#FFFFFF',
};

/** MNP dark tokens from src/styles/tokens.css. Gold is the primary action so the navies are not the only color. */
export const darkColors: Palette = {
  navy: '#73b3e7',
  ink: '#ffffff',
  muted: '#dfe1e2',
  background: '#0b1733',
  card: '#162e51',
  line: '#1a4480',
  green: '#70e17b',
  gold: '#ffbe2e',
  blue: '#73b3e7',
  red: '#ff8d7b',
  fill: '#1f3766',
  header: '#162e51',
  headerText: '#ffffff',
  headerMuted: '#dfe1e2',
  onAccent: '#0b1733',
  accent: '#ffbe2e',
  accentText: '#0b1733',
};

export const colors = lightColors;

type Preference = 'system' | 'light' | 'dark';

interface ThemeValue {
  colors: Palette;
  dark: boolean;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
let published = lightColors;
const paletteListeners = new Set<() => void>();

function publishPalette(next: Palette) {
  published = next;
  paletteListeners.forEach((listener) => listener());
}

export function subscribePalette(listener: () => void) {
  paletteListeners.add(listener);
  return () => paletteListeners.delete(listener);
}

export function getPalette() {
  return published;
}

export function usePalette() {
  return useSyncExternalStore(subscribePalette, getPalette, getPalette);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<Preference>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((raw) => {
      if (raw === 'light' || raw === 'dark' || raw === 'system') setPreference(raw);
    });
  }, []);

  const dark = preference === 'dark' || (preference === 'system' && system === 'dark');

  useEffect(() => {
    publishPalette(dark ? darkColors : lightColors);
  }, [dark]);

  const value = useMemo<ThemeValue>(() => {
    function toggleDark() {
      const next: Preference = dark ? 'light' : 'dark';
      setPreference(next);
      void AsyncStorage.setItem(THEME_KEY, next);
    }
    return { colors: dark ? darkColors : lightColors, dark, toggleDark };
  }, [dark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('ThemeProvider is missing.');
  return value;
}
