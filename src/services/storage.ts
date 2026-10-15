import { createSeed, SAILOR_ID } from '../data/seed';
import type { PrototypeState } from '../domain/types';

export const STORAGE_KEY = 'mnp-accountability-v6';
export const THEME_KEY = 'mnp-theme';

export interface AppSettings {
  connectivity: 'online' | 'offline';
  forceDutyDay: boolean;
  sessionSailorId: string | null;
}

export interface PersistedApp {
  version: 1;
  state: PrototypeState;
  settings: AppSettings;
}

export function defaultSettings(): AppSettings {
  return { connectivity: 'online', forceDutyDay: false, sessionSailorId: SAILOR_ID };
}

export function loadApp(): PersistedApp {
  try {
    if (typeof localStorage === 'undefined') return fresh();
    return readPersisted(localStorage.getItem(STORAGE_KEY));
  } catch {
    return fresh();
  }
}

let writer: ((value: string) => void) | null = null;

export function setAppWriter(next: ((value: string) => void) | null) {
  writer = next;
}

export function readPersisted(raw: string | null): PersistedApp {
  if (!raw) return fresh();
  try {
    const parsed = JSON.parse(raw) as PersistedApp;
    if (parsed.version !== 1 || !parsed.state?.command || !parsed.settings) return fresh();
    return parsed;
  } catch {
    return fresh();
  }
}

export function saveApp(app: PersistedApp) {
  const raw = JSON.stringify(app);
  if (writer) writer(raw);
  else if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, raw);
}

export function fresh(now = new Date()): PersistedApp {
  return { version: 1, state: createSeed(now), settings: defaultSettings() };
}
