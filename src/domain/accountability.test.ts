import { describe, expect, it } from 'vitest';
import { createSeed } from '../data/seed';
import {
  absenceInformsMuster,
  activateEmergency,
  approveSniv,
  approveWorkCenter,
  approvedAbsencesOn,
  confirmWorkCenter,
  overrideMuster,
  pushCommandAccountability,
  submitSelfHelp,
  emergencyAggregate,
  listDependents,
  submitFamily,
  submitMuster,
  snivExcusesMuster,
  synchronize,
  verifyMuster,
} from './accountability';
import type { DomainDeps, FamilyMemberReport, PrototypeState, Sailor } from './types';
import { musterCardModel, workCenterQueue } from './viewModels';

const FIXED = new Date('2026-10-13T22:00:00.000Z');

function deps(online = true): DomainDeps {
  let sequence = 0;
  return {
    now: () => new Date(FIXED),
    id: (prefix) => `${prefix}-test-${sequence += 1}`,
    online,
    forceDutyDay: false,
  };
}

function sailor(state: PrototypeState, id: string): Sailor {
  const match = state.sailors.find((item) => item.id === id);
  if (!match) throw new Error(id);
  return match;
}

function todayMuster(state: PrototypeState, sailorId = 'sailor-alex') {
  return state.musters.filter((record) => record.sailorId === sailorId && record.reportingDate === '2026-10-13');
}

function withoutToday(state: PrototypeState, sailorId = 'sailor-alex'): PrototypeState {
  return {
    ...state,
    musters: state.musters.filter((record) => !(record.sailorId === sailorId && record.reportingDate === '2026-10-13')),
  };
}

describe('accountability rules', () => {
  it('prevents duplicate muster records for the same period', () => {
    const state = withoutToday(createSeed(FIXED));
    const alex = sailor(state, 'sailor-alex');
    const first = submitMuster(state, alex, 'PRESENT', deps());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(todayMuster(first.state)).toHaveLength(1);
    const eventCount = todayMuster(first.state)[0].events.length;
    const second = submitMuster(first.state, alex, 'PRESENT', deps());
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(todayMuster(second.state)).toHaveLength(1);
    expect(todayMuster(second.state)[0].events).toHaveLength(eventCount);
    expect(second.message).toMatch(/already recorded/i);
  });

  it('keeps earlier muster events when a status is corrected', () => {
    const state = withoutToday(createSeed(FIXED));
    const alex = sailor(state, 'sailor-alex');
    const first = submitMuster(state, alex, 'PRESENT', deps());
    if (!first.ok) throw new Error(first.error);
    const second = submitMuster(first.state, alex, 'SICK', deps());
    if (!second.ok) throw new Error(second.error);
    const records = todayMuster(second.state);
    expect(records).toHaveLength(1);
    expect(records[0].events.map((event) => event.status)).toEqual(['PRESENT', 'SICK']);
    expect(records[0].events[0].type).toBe('SUBMITTED');
    expect(records[0].status).toBe('SICK');
  });

  it('does not let a sailor approve their own request', () => {
    const state = createSeed(FIXED);
    const alex = sailor(state, 'sailor-alex');
    const result = approveSniv(state, alex, 'sniv-alex-pending', deps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/own request/i);
    expect(state.snivRequests.find((request) => request.id === 'sniv-alex-pending')?.status).toBe('PENDING_APPROVAL');
  });

  it('does not treat a denied or approved sniv as an excused muster', () => {
    const state = withoutToday(createSeed(FIXED));
    const alex = sailor(state, 'sailor-alex');
    const denied = state.snivRequests.find((request) => request.id === 'sniv-alex-denied');
    expect(denied?.status).toBe('DENIED');
    expect(approvedAbsencesOn(state, alex.id, denied!.date).some((request) => request.id === denied!.id)).toBe(false);
    expect(absenceInformsMuster(denied!, denied!.date)).toBe(false);
    expect(snivExcusesMuster()).toBe(false);
    expect(state.command.musterPolicy.snivSatisfiesMuster).toBe(false);

    const covering = {
      ...state.snivRequests[0],
      date: '2026-10-13',
      endDate: '2026-10-13',
      status: 'APPROVED' as const,
    };
    const withAbsence = { ...state, snivRequests: [covering, ...state.snivRequests.slice(1)] };
    const card = musterCardModel(withAbsence, alex, FIXED, false);
    expect(card.state).toBe('NOT_MUSTERED');
    expect(card.approvedAbsenceNote).toMatch(/Dental Appointment/);

    const before = state.musters.length;
    const approved = approveSniv(state, sailor(state, 'sailor-jordan'), 'sniv-alex-pending', deps());
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.state.musters).toHaveLength(before);
    expect(musterCardModel(approved.state, alex, FIXED, false).state).not.toBe('EXCUSED');
  });

  it('denies family details to anyone except the sponsor', () => {
    const state = createSeed(FIXED);
    const jordan = sailor(state, 'sailor-jordan');
    const alex = sailor(state, 'sailor-alex');
    const lead: Sailor = {
      ...jordan,
      id: 'sailor-lead',
      firstName: 'Morgan',
      lastName: 'Ellis',
      roles: ['SAILOR', 'COMMAND_LEADERSHIP'],
    };
    const withLead = { ...state, sailors: [...state.sailors, lead] };
    expect(listDependents(withLead, jordan, alex.id).ok).toBe(false);
    expect(listDependents(withLead, lead, alex.id).ok).toBe(false);
    const own = listDependents(withLead, alex, alex.id);
    expect(own.ok).toBe(true);
    if (!own.ok) return;
    expect(own.value).toHaveLength(4);
    const aggregate = emergencyAggregate(withLead, lead);
    expect(aggregate.ok).toBe(true);
    if (!aggregate.ok) return;
    expect(JSON.stringify(aggregate.value)).not.toMatch(/Riley|Vargas|0142/);
    expect(emergencyAggregate(withLead, alex).ok).toBe(false);
  });

  it('keeps an offline muster unsynchronized until connectivity returns', () => {
    const state = withoutToday(createSeed(FIXED));
    const alex = sailor(state, 'sailor-alex');
    const queued = submitMuster(state, alex, 'PRESENT', deps(false));
    if (!queued.ok) throw new Error(queued.error);
    const record = todayMuster(queued.state)[0];
    expect(record.syncState).toBe('QUEUED_FOR_SUBMISSION');
    expect(record.verification).toBe('NOT_SUBMITTED');
    expect(record.syncState).not.toBe('RECEIVED_BY_SERVICE');
    expect(record.syncState).not.toBe('VERIFIED_BY_COMMAND');

    const synced = synchronize(queued.state, alex, deps(true));
    if (!synced.ok) throw new Error(synced.error);
    const received = todayMuster(synced.state)[0];
    expect(received.syncState).toBe('RECEIVED_BY_SERVICE');
    expect(received.verification).toBe('AWAITING_VERIFICATION');
    expect(todayMuster(synced.state)).toHaveLength(1);
    const receivedAudits = synced.state.audit.filter((event) => event.action === 'MUSTER_RECEIVED' && event.entityId === received.id);
    expect(receivedAudits).toHaveLength(1);

    const again = synchronize(synced.state, alex, deps(true));
    if (!again.ok) throw new Error(again.error);
    expect(todayMuster(again.state)).toHaveLength(1);
    expect(again.state.audit.filter((event) => event.action === 'MUSTER_RECEIVED' && event.entityId === received.id)).toHaveLength(1);
  });

  it('does not apply a queued muster over a command-verified record', () => {
    const state = withoutToday(createSeed(FIXED));
    const alex = sailor(state, 'sailor-alex');
    const queued = submitMuster(state, alex, 'SICK', deps(false));
    if (!queued.ok) throw new Error(queued.error);
    const original = todayMuster(queued.state)[0];
    const commandCopy = {
      ...original,
      status: 'PRESENT' as const,
      verification: 'VERIFIED' as const,
      syncState: 'VERIFIED_BY_COMMAND' as const,
      idempotencyKey: 'command-authoritative',
    };
    const conflicted = {
      ...queued.state,
      musters: queued.state.musters.map((record) => (record.id === original.id ? commandCopy : record)),
    };
    const synced = synchronize(conflicted, alex, deps(true));
    if (!synced.ok) throw new Error(synced.error);
    const after = todayMuster(synced.state)[0];
    expect(after.status).toBe('PRESENT');
    expect(after.verification).toBe('VERIFIED');
    expect(synced.state.outbox.find((item) => item.entityId === original.id)?.status).toBe('CONFLICT');
  });

  it('blocks a sailor from verifying someone else and keeps NFAAS disconnected while offline', () => {
    const state = createSeed(FIXED);
    const alex = sailor(state, 'sailor-alex');
    const jordanRecord = state.musters.find((record) => record.sailorId === 'sailor-jordan' && record.reportingDate === '2026-10-13');
    expect(verifyMuster(state, alex, jordanRecord!.id, deps()).ok).toBe(false);

    const coordinator: Sailor = {
      ...alex,
      id: 'sailor-coordinator',
      roles: ['SAILOR', 'MUSTER_COORDINATOR'],
    };
    const ready = {
      ...state,
      sailors: [...state.sailors, coordinator],
      emergencies: [
        {
          id: 'event-lumen',
          name: 'Hurricane Lumen',
          kind: 'HURRICANE' as const,
          summary: 'Accountability event for this area.',
          commandIds: [state.command.id],
          active: false,
          activatable: true,
          activatedAt: null,
          closedAt: null,
          sourceSystem: 'NFAAS_SIMULATION' as const,
        },
      ],
    };
    const activated = activateEmergency(ready, coordinator, 'event-lumen', deps());
    if (!activated.ok) throw new Error(activated.error);
    const members: FamilyMemberReport[] = state.dependents.map((person, index) => ({
      dependentId: person.id,
      status: index === 1 ? 'NEEDS_ASSISTANCE' : 'SAFE',
      generalLocation: index === 1 ? 'Meridian Point' : null,
      safeContact: null,
      needs: index === 1 ? ['LODGING'] : [],
      context: index === 1 ? 'Needs a temporary place to stay' : '',
    }));
    const reported = submitFamily(activated.state, alex, 'event-lumen', members, deps(false));
    if (!reported.ok) throw new Error(reported.error);
    const family = reported.state.familyRecords.find((record) => record.emergencyEventId === 'event-lumen');
    expect(family?.syncState).toBe('QUEUED_FOR_SUBMISSION');
    expect(family?.acknowledgment).toBe('NFAAS_NOT_CONNECTED');
    expect(reported.state.familyRecords.filter((record) => record.emergencyEventId === 'event-lumen')).toHaveLength(1);
  });

  it('batch-approves every ready member of the work center and leaves the rest in the queue', () => {
    const state = createSeed(FIXED);
    const jordan = sailor(state, 'sailor-jordan');
    const result = approveWorkCenter(state, jordan, deps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const today = (id: string) => result.state.musters.find((record) => record.sailorId === id && record.reportingDate === '2026-10-13');
    expect(today('sailor-alex')).toBeUndefined();
    expect(today('sailor-samir')?.verification).toBe('VERIFIED');
    expect(today('sailor-rowan')?.verification).toBe('VERIFIED');
    expect(today('sailor-parker')?.verification).toBe('VERIFIED');
    expect(today('sailor-drew')?.verification).toBe('VERIFIED');
    expect(today('sailor-quinn')).toBeUndefined();
    expect(today('sailor-jordan')?.verificationActorId).toBe('sailor-jordan');
    expect(result.state.snivRequests.find((request) => request.id === 'sniv-alex-pending')?.status).toBe('APPROVED');
    expect(result.state.snivRequests.find((request) => request.id === 'sniv-rowan-pending')?.status).toBe('APPROVED');
    expect(result.message).toMatch(/not mustered/i);
    expect(approveWorkCenter(state, sailor(state, 'sailor-alex'), deps()).ok).toBe(false);
  });

  it('includes the supervisor in the work center and approves only the sailors who are selected', () => {
    const state = createSeed(FIXED);
    const jordan = sailor(state, 'sailor-jordan');
    const queue = workCenterQueue(state, jordan, FIXED, false);
    expect(queue.some((member) => member.sailorId === 'sailor-jordan')).toBe(true);
    const selected = confirmWorkCenter(state, jordan, deps(), ['sailor-samir']);
    expect(selected.ok).toBe(true);
    if (!selected.ok) return;
    const today = (id: string) => selected.state.musters.find((record) => record.sailorId === id && record.reportingDate === '2026-10-13');
    expect(today('sailor-samir')?.verification).toBe('VERIFIED');
    expect(today('sailor-rowan')?.verification).toBe('AWAITING_VERIFICATION');
    expect(today('sailor-parker')?.verification).toBe('AWAITING_VERIFICATION');
  });

  it('records a routine late reason with the muster and does not open an emergency request', () => {
    const state = withoutToday(createSeed(FIXED));
    const result = submitMuster(state, sailor(state, 'sailor-alex'), 'PRESENT', deps(), { reason: 'CAR_TROUBLE', note: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(todayMuster(result.state)[0]?.events[0]?.note).toMatch(/Car trouble/);
    expect(result.state.lateReports[0]?.reason).toBe('CAR_TROUBLE');
    expect(result.state.selfHelpRequests).toHaveLength(0);
    expect(result.state.notifications[0]?.title).toBe('Sailor running late');
  });

  it('records a self-help request without an incident narrative for the crisis line', () => {
    const state = createSeed(FIXED);
    const result = submitSelfHelp(
      state,
      sailor(state, 'sailor-alex'),
      { kind: 'CRISIS', detail: 'should not be stored', notifySupervisor: true, subject: 'MYSELF', shipmateId: null },
      deps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const request = result.state.selfHelpRequests[0];
    expect(request.summary).toMatch(/Military Crisis Line/);
    expect(request.summary).not.toMatch(/should not be stored/);
    expect(result.state.notifications[0]?.body).toMatch(/No further detail/);
  });

  it('accepts a typed shipmate name when the sailor is not chosen from the command list', () => {
    const state = createSeed(FIXED);
    const result = submitSelfHelp(
      state,
      sailor(state, 'sailor-alex'),
      { kind: 'RIDE', detail: 'Right now', notifySupervisor: true, subject: 'SHIPMATE', shipmateId: null, shipmateName: 'HN Casey Quinn' },
      deps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.selfHelpRequests[0]?.shipmateId).toBeNull();
    expect(result.state.selfHelpRequests[0]?.shipmateName).toBe('HN Casey Quinn');
    expect(result.state.selfHelpRequests[0]?.summary).toMatch(/HN Casey Quinn/);
  });

  it('notifies every Sailor to validate personnel and families when Navy accountability opens', () => {
    const state = createSeed(FIXED);
    const result = pushCommandAccountability(state, sailor(state, 'sailor-xo'), true, deps());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const notes = result.state.notifications.filter((item) => item.title === 'Navy accountability');
    const commandIds = state.sailors.filter((item) => item.commandId === state.command.id).map((item) => item.id);
    expect(notes.map((item) => item.recipientId).sort()).toEqual([...commandIds].sort());
    expect(notes.every((item) => item.pushEligible && item.kind === 'EMERGENCY_ACTIVATED')).toBe(true);
    expect(notes[0]?.body).toMatch(/family/i);
    expect(notes[0]?.body).toMatch(/status/i);
  });

  it('lets the command certifier override a confirmed muster and record one that was not submitted', () => {
    const state = createSeed(FIXED);
    const xo = sailor(state, 'sailor-xo');
    const denied = overrideMuster(state, sailor(state, 'sailor-jordan'), 'sailor-samir', 'SICK', deps());
    expect(denied.ok).toBe(false);
    const overridden = overrideMuster(state, xo, 'sailor-jordan', 'SICK', deps());
    expect(overridden.ok).toBe(true);
    if (!overridden.ok) return;
    const jordan = todayMuster(overridden.state, 'sailor-jordan')[0];
    expect(jordan?.status).toBe('SICK');
    expect(jordan?.verification).toBe('VERIFIED');
    expect(jordan?.events.at(-1)?.type).toBe('CERTIFIER_OVERRIDE');
    expect(jordan?.events.length).toBeGreaterThan(1);
    const recorded = overrideMuster(state, xo, 'sailor-quinn', 'PRESENT', deps());
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    expect(todayMuster(recorded.state, 'sailor-quinn')[0]?.verification).toBe('VERIFIED');
  });
});
