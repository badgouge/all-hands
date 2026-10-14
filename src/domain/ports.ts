import type { AppNotification, EmergencyEvent, PrototypeState, Sailor } from './types';

/**
 * Integration ports for future Navy systems.
 * No production API URLs are defined. Connectivity and write access are unresolved.
 */

export interface PushNotificationPort {
  deliver(notification: AppNotification): { delivered: false; reason: 'NO_PROVIDER' };
}

export const prototypePush: PushNotificationPort = {
  deliver() {
    return { delivered: false, reason: 'NO_PROVIDER' };
  },
};

export interface NfaasPort {
  readonly connected: false;
  readonly note: string;
  activeEvents(state: PrototypeState, commandId: string): EmergencyEvent[];
  impactedSailorIds(state: PrototypeState, event: EmergencyEvent): string[];
}

export const prototypeNfaas: NfaasPort = {
  connected: false,
  note: 'NFAAS is not connected. Submissions stay in the prototype and are never treated as NFAAS acknowledgements.',
  activeEvents(state, commandId) {
    return state.emergencies.filter((event) => event.active && event.commandIds.includes(commandId));
  },
  impactedSailorIds(state, event) {
    return state.sailors.filter((sailor) => event.commandIds.includes(sailor.commandId)).map((sailor) => sailor.id);
  },
};

export interface IdentityPort {
  /** Mock session only. This is not CAC, PIV, or production authentication. */
  authenticate(sailorId: string, roster: Sailor[]): Sailor | null;
}

export const prototypeIdentity: IdentityPort = {
  authenticate(sailorId, roster) {
    return roster.find((sailor) => sailor.id === sailorId) ?? null;
  },
};
