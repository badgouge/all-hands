import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { accountabilityService } from '../../services/accountabilityService';
import { loadApp, saveApp, type AppSettings, type PersistedApp } from '../../services/storage';
import type { DomainDeps, FamilyHelpKind, FamilyMemberReport, FamilyStatus, HelpSubject, LateReason, MusterStatus, Mutation, PrototypeState, Sailor, SelfHelpKind, ShareLocation, SnivInput, WorkCenterSettingsInput } from '../../domain/types';

interface AccountabilityApi {
  state: PrototypeState;
  settings: AppSettings;
  sailor: Sailor | null;
  flash: string | null;
  notice: number;
  clearFlash: () => void;
  signIn: (sailorId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setPreparedness: (itemId: string, checked: boolean) => void;
  submitMuster: (status: MusterStatus, late?: { reason: LateReason; note: string } | null) => Mutation;
  verifyMuster: (recordId: string) => Mutation;
  flagMuster: (recordId: string, reason: string) => Mutation;
  correctMuster: (recordId: string, status: MusterStatus, reason: string) => Mutation;
  saveSnivDraft: (input: SnivInput) => Mutation;
  submitSniv: (input: SnivInput) => Mutation;
  approveSniv: (id: string) => Mutation;
  approveWorkCenter: () => Mutation;
  confirmWorkCenter: (sailorIds?: string[]) => Mutation;
  updateWorkCenterSettings: (input: WorkCenterSettingsInput) => Mutation;
  updateDependentContact: (dependentId: string, phone: string, address: string) => Mutation;
  updateHousehold: (phone: string, address: string) => Mutation;
  setShareLocation: (mode: ShareLocation) => Mutation;
  startSailorAccountability: () => Mutation;
  submitSelfHelp: (input: {
    kind: SelfHelpKind;
    detail: string;
    notifySupervisor: boolean;
    subject: HelpSubject;
    shipmateId: string | null;
    shipmateName?: string | null;
  }) => Mutation;
  submitFamilyHelp: (input: { dependentIds: string[]; kind: FamilyHelpKind; location: string; remarks: string }) => Mutation;
  pushCommandAccountability: (open: boolean) => Mutation;
  accountForFamily: (accounted: boolean) => Mutation;
  musterOnBehalf: (sailorId: string, status: MusterStatus) => Mutation;
  overrideMuster: (sailorId: string, status: MusterStatus) => Mutation;
  certifyCommand: () => Mutation;
  submitDependentStatus: (dependentId: string, status: Exclude<FamilyStatus, 'NOT_REPORTED'>, location: string, remarks: string) => Mutation;
  denySniv: (id: string, reason: string) => Mutation;
  returnSniv: (id: string, reason: string) => Mutation;
  cancelSniv: (id: string) => Mutation;
  submitFamily: (eventId: string, members: FamilyMemberReport[]) => Mutation;
  requestFamilyReview: (note: string) => Mutation;
  activateEmergency: (eventId: string) => Mutation;
  deactivateEmergency: (eventId: string) => Mutation;
}

const AccountabilityContext = createContext<AccountabilityApi | null>(null);

export function AccountabilityProvider({ children, initialApp }: { children: ReactNode; initialApp?: PersistedApp }) {
  const [app, setApp] = useState<PersistedApp>(() => initialApp ?? loadApp());
  const [flash, setFlash] = useState<string | null>(null);
  const [notice, setNotice] = useState(0);
  const appRef = useRef(app);
  appRef.current = app;

  const depsFor = (settings: AppSettings): DomainDeps => ({
    now: () => new Date(),
    id: (prefix) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`,
    online: settings.connectivity === 'online',
    forceDutyDay: settings.forceDutyDay,
  });

  function commit(next: PersistedApp) {
    appRef.current = next;
    saveApp(next);
    setApp(next);
  }

  useEffect(() => {
    const current = appRef.current;
    const prepared = accountabilityService.prepare(current.state, depsFor(current.settings));
    if (prepared !== current.state) commit({ ...current, state: prepared });
    // Prepare once on load so derived request completion is stored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useMemo<AccountabilityApi>(() => {
    function mutate(run: (state: PrototypeState, actor: Sailor, deps: DomainDeps) => Mutation): Mutation {
      const current = appRef.current;
      const actor = accountabilityService.identity.authenticate(current.settings.sessionSailorId ?? '', current.state.sailors);
      if (!actor) return { ok: false, error: 'You are not signed in.' };
      const deps = depsFor(current.settings);
      const prepared = accountabilityService.prepare(current.state, deps);
      const result = run(prepared, actor, deps);
      if (!result.ok) {
        if (prepared !== current.state) commit({ ...current, state: prepared });
        return result;
      }
      commit({ ...current, state: result.state });
      setFlash(result.message);
      setNotice((value) => value + 1);
      return result;
    }

    return {
      state: app.state,
      settings: app.settings,
      sailor: accountabilityService.identity.authenticate(app.settings.sessionSailorId ?? '', app.state.sailors),
      flash,
      notice,
      clearFlash: () => setFlash(null),
      signIn(sailorId) {
        const current = appRef.current;
        const actor = accountabilityService.identity.authenticate(sailorId, current.state.sailors);
        if (!actor) return;
        commit({ ...current, settings: { ...current.settings, sessionSailorId: sailorId } });
        setFlash(null);
      },
      markNotificationRead(id) {
        const current = appRef.current;
        const at = new Date().toISOString();
        commit({
          ...current,
          state: {
            ...current.state,
            notifications: current.state.notifications.map((item) =>
              item.id === id && item.recipientId === current.settings.sessionSailorId && !item.readAt ? { ...item, readAt: at } : item,
            ),
          },
        });
      },
      markAllNotificationsRead() {
        const current = appRef.current;
        const at = new Date().toISOString();
        commit({
          ...current,
          state: {
            ...current.state,
            notifications: current.state.notifications.map((item) =>
              item.recipientId === current.settings.sessionSailorId && !item.readAt ? { ...item, readAt: at } : item,
            ),
          },
        });
      },
      setPreparedness(itemId, checked) {
        const current = appRef.current;
        const sailorId = current.settings.sessionSailorId;
        if (!sailorId) return;
        const existing = current.state.preparednessChecks[sailorId] ?? [];
        const next = checked ? [...new Set([...existing, itemId])] : existing.filter((item) => item !== itemId);
        commit({
          ...current,
          state: { ...current.state, preparednessChecks: { ...current.state.preparednessChecks, [sailorId]: next } },
        });
      },
      submitMuster: (status, late) => mutate((state, actor, deps) => accountabilityService.submitMuster(state, actor, status, deps, late)),
      verifyMuster: (recordId) => mutate((state, actor, deps) => accountabilityService.verifyMuster(state, actor, recordId, deps)),
      flagMuster: (recordId, reason) => mutate((state, actor, deps) => accountabilityService.flagMuster(state, actor, recordId, reason, deps)),
      correctMuster: (recordId, status, reason) =>
        mutate((state, actor, deps) => accountabilityService.correctMuster(state, actor, recordId, status, reason, deps)),
      saveSnivDraft: (input) => mutate((state, actor, deps) => accountabilityService.saveSnivDraft(state, actor, input, deps)),
      submitSniv: (input) => mutate((state, actor, deps) => accountabilityService.submitSniv(state, actor, input, deps)),
      approveSniv: (id) => mutate((state, actor, deps) => accountabilityService.approveSniv(state, actor, id, deps)),
      approveWorkCenter: () => mutate((state, actor, deps) => accountabilityService.approveWorkCenter(state, actor, deps)),
      confirmWorkCenter: (sailorIds) => mutate((state, actor, deps) => accountabilityService.confirmWorkCenter(state, actor, deps, sailorIds)),
      updateWorkCenterSettings: (input) => mutate((state, actor, deps) => accountabilityService.updateWorkCenterSettings(state, actor, input, deps)),
      updateDependentContact(dependentId, phone, address) {
        const current = appRef.current;
        const actor = accountabilityService.identity.authenticate(current.settings.sessionSailorId ?? '', current.state.sailors);
        if (!actor) return { ok: false, error: 'You are not signed in.' };
        const prepared = accountabilityService.prepare(current.state, depsFor(current.settings));
        const result = accountabilityService.updateDependentContact(prepared, actor, dependentId, phone, address);
        if (!result.ok) return result;
        commit({ ...current, state: result.state });
        setFlash(result.message);
        setNotice((value) => value + 1);
        return result;
      },
      updateHousehold(phone, address) {
        const current = appRef.current;
        const actor = accountabilityService.identity.authenticate(current.settings.sessionSailorId ?? '', current.state.sailors);
        if (!actor) return { ok: false, error: 'You are not signed in.' };
        const result = accountabilityService.updateHousehold(current.state, actor, phone, address);
        if (!result.ok) return result;
        commit({ ...current, state: result.state });
        setFlash(result.message);
        setNotice((value) => value + 1);
        return result;
      },
      setShareLocation(mode) {
        const current = appRef.current;
        const actor = accountabilityService.identity.authenticate(current.settings.sessionSailorId ?? '', current.state.sailors);
        if (!actor) return { ok: false, error: 'You are not signed in.' };
        const result = accountabilityService.setShareLocation(current.state, actor, mode);
        if (!result.ok) return result;
        commit({ ...current, state: result.state });
        setFlash(result.message);
        setNotice((value) => value + 1);
        return result;
      },
      startSailorAccountability: () => mutate((state, actor, deps) => accountabilityService.startSailorAccountability(state, actor, deps)),
      submitSelfHelp: (input) => mutate((state, actor, deps) => accountabilityService.submitSelfHelp(state, actor, input, deps)),
      submitFamilyHelp: (input) => mutate((state, actor, deps) => accountabilityService.submitFamilyHelp(state, actor, input, deps)),
      pushCommandAccountability: (open) => mutate((state, actor, deps) => accountabilityService.pushCommandAccountability(state, actor, open, deps)),
      accountForFamily: (accounted) => mutate((state, actor, deps) => accountabilityService.accountForFamily(state, actor, accounted, deps)),
      musterOnBehalf: (sailorId, status) => mutate((state, actor, deps) => accountabilityService.musterOnBehalf(state, actor, sailorId, status, deps)),
      overrideMuster: (sailorId, status) => mutate((state, actor, deps) => accountabilityService.overrideMuster(state, actor, sailorId, status, deps)),
      certifyCommand: () => mutate((state, actor, deps) => accountabilityService.certifyCommand(state, actor, deps)),
      submitDependentStatus: (dependentId, status, location, remarks) =>
        mutate((state, actor, deps) => accountabilityService.submitDependentStatus(state, actor, dependentId, status, location, remarks, deps)),
      denySniv: (id, reason) => mutate((state, actor, deps) => accountabilityService.denySniv(state, actor, id, reason, deps)),
      returnSniv: (id, reason) => mutate((state, actor, deps) => accountabilityService.returnSniv(state, actor, id, reason, deps)),
      cancelSniv: (id) => mutate((state, actor, deps) => accountabilityService.cancelSniv(state, actor, id, deps)),
      submitFamily: (eventId, members) => mutate((state, actor, deps) => accountabilityService.submitFamily(state, actor, eventId, members, deps)),
      requestFamilyReview: (note) => mutate((state, actor, deps) => accountabilityService.requestFamilyReview(state, actor, note, deps)),
      activateEmergency: (eventId) => mutate((state, actor, deps) => accountabilityService.activateEmergency(state, actor, eventId, deps)),
      deactivateEmergency: (eventId) => mutate((state, actor, deps) => accountabilityService.deactivateEmergency(state, actor, eventId, deps)),
    };
  }, [app, flash, notice]);

  return <AccountabilityContext.Provider value={api}>{children}</AccountabilityContext.Provider>;
}

export function useAccountability() {
  const value = useContext(AccountabilityContext);
  if (!value) throw new Error('AccountabilityProvider is missing.');
  return value;
}
