import { LATE_REASON_LABEL, summarizeFamilyHelp, summarizeSelfHelp } from './help';
import { displayName, SNIV_CATEGORY_LABEL } from './labels';
import { prototypePush } from './ports';
import {
  addDays,
  dateRange,
  formatMilitary,
  intervalMinutes,
  minutesOfDay,
  partsInZone,
  todayInZone,
  weekdayIndex,
  zonedLocalToUtc,
} from './time';
import type {
  AppNotification,
  AuditEvent,
  Command,
  CommandCertification,
  DomainDeps,
  EmergencyEvent,
  FamilyAccountabilityRecord,
  FamilyHelpKind,
  FamilyHelpRequest,
  HelpSubject,
  LateReason,
  FamilyMemberReport,
  FamilyStatus,
  WorkCenterSettingsInput,
  MusterPeriod,
  MusterRecord,
  MusterStatus,
  MusterVerification,
  Mutation,
  NeedType,
  NotificationKind,
  OutboxItem,
  PrototypeState,
  Result,
  Sailor,
  SelfHelpKind,
  SelfHelpRequest,
  ShareLocation,
  SnivInput,
  SnivRequest,
  SnivStatus,
  SourceSystem,
  SyncState,
} from './types';
import { SOURCE_APPLICATION } from './types';

export function fail(error: string): Mutation {
  return { ok: false, error };
}

export function sailorById(state: PrototypeState, id: string): Sailor | undefined {
  return state.sailors.find((sailor) => sailor.id === id);
}

export function assignmentFor(state: PrototypeState, sailorId: string) {
  return state.assignments.find((item) => item.sailorId === sailorId && item.endDate === null);
}

export function supervisorFor(state: PrototypeState, sailorId: string): Sailor | undefined {
  const link = state.relationships.find((item) => item.sailorId === sailorId && item.active);
  return link ? sailorById(state, link.supervisorId) : undefined;
}

export function directReports(state: PrototypeState, supervisorId: string): Sailor[] {
  const ids = new Set(
    state.relationships.filter((item) => item.supervisorId === supervisorId && item.active).map((item) => item.sailorId),
  );
  return state.sailors.filter((sailor) => ids.has(sailor.id));
}

export function hasRole(sailor: Sailor, role: Sailor['roles'][number]): boolean {
  return sailor.roles.includes(role);
}

export function rosterScope(actor: Sailor): 'COMMAND' | 'DIRECT_REPORTS' | 'NONE' {
  if (hasRole(actor, 'COMMAND_LEADERSHIP') || hasRole(actor, 'MUSTER_COORDINATOR')) return 'COMMAND';
  if (hasRole(actor, 'SUPERVISOR')) return 'DIRECT_REPORTS';
  return 'NONE';
}

export function canVerifyMuster(state: PrototypeState, actor: Sailor, subjectId: string): boolean {
  if (actor.id === subjectId) return false;
  if (actor.commandId !== sailorById(state, subjectId)?.commandId) return false;
  if (hasRole(actor, 'MUSTER_COORDINATOR')) return true;
  if (hasRole(actor, 'SUPERVISOR')) {
    return directReports(state, actor.id).some((sailor) => sailor.id === subjectId);
  }
  return false;
}

export function periodForDate(state: PrototypeState, isoDate: string): MusterPeriod | undefined {
  return state.periods.find((period) => period.reportingDate === isoDate && period.commandId === state.command.id);
}

export function isPeriodRequired(period: MusterPeriod, now: Date, timeZone: string, forceDutyDay: boolean): boolean {
  if (period.required) return true;
  return forceDutyDay && period.reportingDate === todayInZone(timeZone, now);
}

export type PeriodPhase = 'NOT_REQUIRED' | 'UPCOMING' | 'PRIMARY' | 'LATE' | 'CLOSED';

export function periodPhase(period: MusterPeriod, now: Date, timeZone: string, forceDutyDay: boolean): PeriodPhase {
  if (!isPeriodRequired(period, now, timeZone, forceDutyDay)) return 'NOT_REQUIRED';
  const today = todayInZone(timeZone, now);
  if (period.reportingDate > today) return 'UPCOMING';
  if (period.reportingDate < today) return 'CLOSED';
  const nowMinutes = minutesOfDay(`${partsInZone(now, timeZone).hour}:${partsInZone(now, timeZone).minute}`);
  if (nowMinutes <= minutesOfDay(period.windowEnd)) return 'PRIMARY';
  if (nowMinutes <= minutesOfDay(period.lateUntil)) return 'LATE';
  return 'CLOSED';
}

export function makePeriod(command: Command, isoDate: string): MusterPeriod {
  const weekday = weekdayIndex(isoDate, command.timezone);
  const holiday = command.musterPolicy.holidays.includes(isoDate);
  const dutyDay = command.musterPolicy.dutyDays.includes(weekday);
  const required = dutyDay && !holiday;
  return {
    id: `period-${command.id}-${isoDate}`,
    commandId: command.id,
    reportingDate: isoDate,
    windowStart: command.musterPolicy.primaryWindowStart,
    windowEnd: command.musterPolicy.primaryWindowEnd,
    lateUntil: command.musterPolicy.lateWindowEnd,
    required,
    reasonIfNotRequired: required ? null : holiday ? 'HOLIDAY' : 'WEEKEND',
  };
}

export function ensureCalendar(state: PrototypeState, now: Date): PrototypeState {
  const today = todayInZone(state.command.timezone, now);
  const existing = new Set(state.periods.map((period) => period.reportingDate));
  const additions = dateRange(addDays(today, -14), today)
    .filter((date) => !existing.has(date))
    .map((date) => makePeriod(state.command, date));
  if (additions.length === 0) return state;
  return {
    ...state,
    periods: [...state.periods, ...additions].sort((a, b) => a.reportingDate.localeCompare(b.reportingDate)),
  };
}

function stamp(deps: DomainDeps): string {
  return deps.now().toISOString();
}

function pushAudit(
  state: PrototypeState,
  deps: DomainDeps,
  input: Omit<AuditEvent, 'id' | 'at' | 'sourceApplication'>,
): PrototypeState {
  const event: AuditEvent = {
    ...input,
    id: deps.id('audit'),
    at: stamp(deps),
    sourceApplication: SOURCE_APPLICATION,
  };
  return { ...state, audit: [event, ...state.audit] };
}

function pushNotification(
  state: PrototypeState,
  deps: DomainDeps,
  input: Omit<AppNotification, 'id' | 'createdAt' | 'readAt' | 'pushDelivery'>,
): PrototypeState {
  const notification: AppNotification = {
    ...input,
    id: deps.id('notice'),
    createdAt: stamp(deps),
    readAt: null,
    pushDelivery: 'NOT_SENT_NO_PROVIDER',
  };
  prototypePush.deliver(notification);
  return { ...state, notifications: [notification, ...state.notifications] };
}

function queue(
  state: PrototypeState,
  deps: DomainDeps,
  item: Omit<OutboxItem, 'id' | 'createdAt' | 'status' | 'conflictNote'>,
): PrototypeState {
  const without = state.outbox.filter((existing) => !(existing.entityId === item.entityId && existing.status === 'QUEUED'));
  const next: OutboxItem = {
    ...item,
    id: deps.id('outbox'),
    createdAt: stamp(deps),
    status: 'QUEUED',
    conflictNote: null,
  };
  return { ...state, outbox: [next, ...without] };
}

function musterKey(sailorId: string, periodId: string, status: MusterStatus): string {
  return `muster:${sailorId}:${periodId}:${status}`;
}

function businessMusterState(record: Pick<MusterRecord, 'status' | 'verification' | 'syncState'>): string {
  return `${record.status}:${record.verification}:${record.syncState}`;
}

export function currentMuster(state: PrototypeState, sailorId: string, isoDate: string): MusterRecord | undefined {
  return state.musters.find((record) => record.sailorId === sailorId && record.reportingDate === isoDate);
}

export function submitMuster(
  state: PrototypeState,
  actor: Sailor,
  status: MusterStatus,
  deps: DomainDeps,
  late?: { reason: LateReason; note: string } | null,
): Mutation {
  const timeZone = state.command.timezone;
  const today = todayInZone(timeZone, deps.now());
  const period = periodForDate(state, today);
  if (!period) return fail('No muster period is open for today.');
  const phase = periodPhase(period, deps.now(), timeZone, deps.forceDutyDay);
  if (phase === 'NOT_REQUIRED') return fail('Muster is not required today for your command.');
  if (phase === 'UPCOMING') return fail(`The muster window opens at ${formatMilitary(period.windowStart)}.`);
  if (phase === 'CLOSED') return fail('The muster window is closed for today.');

  const blocked = sailorMaySelect(state, actor, status);
  if (blocked) return fail(blocked);

  const key = musterKey(actor.id, period.id, status);
  const existing = currentMuster(state, actor.id, today);
  if (existing && existing.idempotencyKey === key) {
    return { ok: true, state, message: 'This muster was already recorded.', entityId: existing.id };
  }
  if (existing?.verification === 'VERIFIED') {
    return fail('Muster is already confirmed. Ask your supervisor if it needs a correction.');
  }
  if (existing?.verification === 'DISCREPANCY') {
    return fail('Your command flagged this muster. You cannot replace it from your phone.');
  }
  if (existing && !state.command.musterPolicy.allowSailorCorrection) {
    return fail('Your command is not accepting muster corrections from the phone.');
  }

  const lateNote = late?.note.trim() ?? '';
  if (late?.reason === 'OTHER' && lateNote.length < 3) return fail('Say why you are running late.');
  const runningLate = late ? `Running late. ${LATE_REASON_LABEL[late.reason]}${lateNote ? `. ${lateNote}` : ''}` : null;
  const origin = 'SAILOR_REPORTED' as const;
  const source: SourceSystem = 'SAILOR_ATTESTATION';
  const syncState: SyncState = deps.online ? 'RECEIVED_BY_SERVICE' : 'QUEUED_FOR_SUBMISSION';
  const verification: MusterVerification = deps.online ? 'AWAITING_VERIFICATION' : 'NOT_SUBMITTED';
  const at = stamp(deps);
  const event = {
    id: deps.id('muster-event'),
    at,
    actorId: actor.id,
    type: existing ? 'CORRECTED' as const : 'SUBMITTED' as const,
    status,
    verification,
    note: [phase === 'LATE' ? 'Reported after the primary deadline.' : null, runningLate].filter(Boolean).join(' ') || null,
    source,
    idempotencyKey: key,
  };
  const record: MusterRecord = {
    id: existing?.id ?? deps.id('muster'),
    sailorId: actor.id,
    commandId: actor.commandId,
    uic: state.command.uic,
    periodId: period.id,
    reportingDate: today,
    status,
    statusOrigin: origin,
    sourceSystem: source,
    linkedSnivRequestId: null,
    submittedAt: at,
    verification,
    verificationActorId: null,
    verifiedAt: null,
    syncState,
    idempotencyKey: key,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
    events: [...(existing?.events ?? []), event],
  };
  let next: PrototypeState = {
    ...state,
    musters: existing ? state.musters.map((item) => (item.id === existing.id ? record : item)) : [record, ...state.musters],
  };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: existing ? 'MUSTER_CORRECTED' : 'MUSTER_SUBMITTED',
    entityType: 'MusterRecord',
    entityId: record.id,
    previousState: existing ? businessMusterState(existing) : null,
    newState: businessMusterState(record),
    metadata: { late: phase === 'LATE' || Boolean(late) ? 'true' : 'false', idempotencyKey: key, lateReason: late?.reason ?? '' },
  });
  if (late && runningLate) {
    const supervisor = supervisorFor(next, actor.id);
    next = {
      ...next,
      lateReports: [
        {
          id: deps.id('late'),
          sailorId: actor.id,
          reportingDate: today,
          reason: late.reason,
          note: lateNote,
          createdAt: at,
        },
        ...(next.lateReports ?? []),
      ],
    };
    if (supervisor) {
      next = pushNotification(next, deps, {
        recipientId: supervisor.id,
        kind: 'MUSTER_DEADLINE',
        title: 'Sailor running late',
        body: `${displayName(actor)} is running late. ${LATE_REASON_LABEL[late.reason]}.`,
        href: '/team',
        pushEligible: true,
      });
    }
  }
  if (!deps.online) {
    next = queue(next, deps, {
      idempotencyKey: key,
      kind: 'MUSTER',
      entityId: record.id,
      sailorId: actor.id,
      baselineUpdatedAt: at,
    });
  }
  const message = deps.online
    ? phase === 'LATE'
      ? 'Muster submitted after the primary deadline. Awaiting command verification.'
      : 'Muster submitted. Awaiting command verification.'
    : 'Muster saved on this device. Your command has not received it.';
  return { ok: true, state: next, message, entityId: record.id };
}

function sailorMaySelect(_state: PrototypeState, _actor: Sailor, _status: MusterStatus): string | null {
  return null;
}

function receivedMuster(record: MusterRecord): string | null {
  if (record.syncState === 'QUEUED_FOR_SUBMISSION' || record.syncState === 'SAVED_ON_DEVICE') {
    return 'This muster is still on the device and has not been received by the command.';
  }
  return null;
}

export function verifyMuster(state: PrototypeState, actor: Sailor, recordId: string, deps: DomainDeps): Mutation {
  const record = state.musters.find((item) => item.id === recordId);
  if (!record) return fail('Muster record not found.');
  if (!canVerifyMuster(state, actor, record.sailorId)) return fail('You are not authorized to verify this muster.');
  return completeVerification(state, actor, record, deps, null);
}

function completeVerification(
  state: PrototypeState,
  actor: Sailor,
  record: MusterRecord,
  deps: DomainDeps,
  note: string | null,
): Mutation {
  const blocked = receivedMuster(record);
  if (blocked) return fail(blocked);
  if (record.verification === 'VERIFIED') {
    return { ok: true, state, message: 'Muster is already confirmed.', entityId: record.id };
  }
  const at = stamp(deps);
  const nextRecord: MusterRecord = {
    ...record,
    verification: 'VERIFIED',
    verificationActorId: actor.id,
    verifiedAt: at,
    syncState: 'VERIFIED_BY_COMMAND',
    updatedAt: at,
    events: [
      ...record.events,
      {
        id: deps.id('muster-event'),
        at,
        actorId: actor.id,
        type: 'VERIFIED',
        status: record.status,
        verification: 'VERIFIED',
        note,
        source: 'MUSTER_SERVICE',
        idempotencyKey: record.idempotencyKey,
      },
    ],
  };
  let next = replaceMuster(state, nextRecord);
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: record.sailorId,
    action: 'MUSTER_VERIFIED',
    entityType: 'MusterRecord',
    entityId: record.id,
    previousState: businessMusterState(record),
    newState: businessMusterState(nextRecord),
    metadata: {},
  });
  next = pushNotification(next, deps, {
    recipientId: record.sailorId,
    kind: 'MUSTER_VERIFIED',
    title: 'Muster verified',
    body: 'Your command confirmed today’s muster.',
    href: '/accountability',
    pushEligible: true,
  });
  return { ok: true, state: next, message: 'Muster confirmed.', entityId: record.id };
}

export function approveWorkCenter(state: PrototypeState, actor: Sailor, deps: DomainDeps): Mutation {
  if (rosterScope(actor) === 'NONE') return fail('You are not authorized to approve a work center.');
  const reports = directReports(state, actor.id);
  if (reports.length === 0) return fail('No Sailors are assigned to your work center.');
  const today = todayInZone(state.command.timezone, deps.now());
  let next = state;
  let musters = 0;
  let snivs = 0;
  const notMustered: string[] = [];

  for (const sailor of reports) {
    const record = currentMuster(next, sailor.id, today);
    if (!record) {
      notMustered.push(displayName(sailor));
      continue;
    }
    if (record.verification !== 'AWAITING_VERIFICATION') continue;
    if (record.syncState === 'QUEUED_FOR_SUBMISSION' || record.syncState === 'SAVED_ON_DEVICE') continue;
    const result = verifyMuster(next, actor, record.id, deps);
    if (!result.ok) return result;
    next = result.state;
    musters += 1;
  }

  const pending = next.snivRequests.filter(
    (request) =>
      request.supervisorId === actor.id &&
      request.status === 'PENDING_APPROVAL' &&
      request.syncState === 'RECEIVED_BY_SERVICE' &&
      reports.some((sailor) => sailor.id === request.sailorId),
  );
  for (const request of pending) {
    const result = approveSniv(next, actor, request.id, deps);
    if (!result.ok) return result;
    next = result.state;
    snivs += 1;
  }

  if (musters === 0 && snivs === 0) {
    return fail(
      notMustered.length > 0
        ? `Nothing is ready to approve. ${notMustered.join(', ')} ${notMustered.length === 1 ? 'has' : 'have'} not mustered.`
        : 'Nothing in the work center is waiting for approval.',
    );
  }

  const parts: string[] = [];
  if (musters > 0) parts.push(`${musters} muster${musters === 1 ? '' : 's'} confirmed`);
  if (snivs > 0) parts.push(`${snivs} snivel request${snivs === 1 ? '' : 's'} approved`);
  const held =
    notMustered.length > 0
      ? ` ${notMustered.join(', ')} ${notMustered.length === 1 ? 'has' : 'have'} not mustered and ${notMustered.length === 1 ? 'was' : 'were'} left in the queue.`
      : '';
  return { ok: true, state: next, message: `Work center approved. ${parts.join(' and ')}.${held}` };
}

export function confirmWorkCenter(state: PrototypeState, actor: Sailor, deps: DomainDeps, sailorIds?: string[]): Mutation {
  if (rosterScope(actor) === 'NONE') return fail('You are not authorized to confirm a work center.');
  const reports = directReports(state, actor.id);
  const roster = [actor, ...reports.filter((sailor) => sailor.id !== actor.id)];
  const targets = sailorIds ? roster.filter((sailor) => sailorIds.includes(sailor.id)) : reports;
  if (targets.length === 0) {
    return fail(sailorIds ? 'Select at least one Sailor to approve.' : 'No Sailors are assigned to your work center.');
  }
  const today = todayInZone(state.command.timezone, deps.now());
  let next = state;
  let musters = 0;
  const notMustered: string[] = [];

  for (const sailor of targets) {
    const record = currentMuster(next, sailor.id, today);
    if (!record) {
      notMustered.push(displayName(sailor));
      continue;
    }
    if (record.verification !== 'AWAITING_VERIFICATION') continue;
    if (record.syncState === 'QUEUED_FOR_SUBMISSION' || record.syncState === 'SAVED_ON_DEVICE') continue;
    const result =
      sailor.id === actor.id
        ? completeVerification(next, actor, record, deps, 'Included in the work center approval.')
        : verifyMuster(next, actor, record.id, deps);
    if (!result.ok) return result;
    next = result.state;
    musters += 1;
  }

  if (musters === 0) {
    return fail(
      notMustered.length > 0
        ? `No musters are waiting. ${notMustered.join(', ')} ${notMustered.length === 1 ? 'has' : 'have'} not mustered.`
        : 'No musters are waiting for confirmation.',
    );
  }

  const held =
    notMustered.length > 0
      ? ` ${notMustered.join(', ')} ${notMustered.length === 1 ? 'has' : 'have'} not mustered and ${notMustered.length === 1 ? 'was' : 'were'} left in the queue.`
      : '';
  return {
    ok: true,
    state: next,
    message: `Work center approved. ${musters} muster${musters === 1 ? '' : 's'} confirmed.${held}`,
  };
}

export function musterOnBehalf(
  state: PrototypeState,
  actor: Sailor,
  sailorId: string,
  status: MusterStatus,
  deps: DomainDeps,
): Mutation {
  if (!canVerifyMuster(state, actor, sailorId)) return fail('You are not authorized to muster on behalf of this Sailor.');
  const sailor = sailorById(state, sailorId);
  if (!sailor) return fail('Sailor not found.');
  const timeZone = state.command.timezone;
  const today = todayInZone(timeZone, deps.now());
  const period = periodForDate(state, today);
  if (!period) return fail('No muster period is open for today.');
  const phase = periodPhase(period, deps.now(), timeZone, deps.forceDutyDay);
  if (phase === 'NOT_REQUIRED') return fail('Muster is not required today.');
  if (phase === 'UPCOMING' || phase === 'CLOSED') return fail('The muster window is not open.');
  if (currentMuster(state, sailorId, today)) return fail('This Sailor already has a muster for today.');

  const at = stamp(deps);
  const key = musterKey(sailorId, period.id, status);
  const note = `Mustered on behalf of the Sailor by ${displayName(actor)}.`;
  const record: MusterRecord = {
    id: deps.id('muster'),
    sailorId,
    commandId: sailor.commandId,
    uic: state.command.uic,
    periodId: period.id,
    reportingDate: today,
    status,
    statusOrigin: 'SAILOR_REPORTED',
    sourceSystem: 'MUSTER_SERVICE',
    linkedSnivRequestId: null,
    submittedAt: at,
    verification: 'VERIFIED',
    verificationActorId: actor.id,
    verifiedAt: at,
    syncState: 'VERIFIED_BY_COMMAND',
    idempotencyKey: key,
    createdAt: at,
    updatedAt: at,
    events: [
      {
        id: deps.id('muster-event'),
        at,
        actorId: actor.id,
        type: 'SUPERVISOR_CORRECTION',
        status,
        verification: 'VERIFIED',
        note,
        source: 'MUSTER_SERVICE',
        idempotencyKey: key,
      },
    ],
  };
  let next: PrototypeState = { ...state, musters: [record, ...state.musters] };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: sailorId,
    action: 'MUSTER_ON_BEHALF',
    entityType: 'MusterRecord',
    entityId: record.id,
    previousState: null,
    newState: businessMusterState(record),
    metadata: { note },
  });
  next = pushNotification(next, deps, {
    recipientId: sailorId,
    kind: 'MUSTER_VERIFIED',
    title: 'Muster recorded for you',
    body: 'Your supervisor recorded today’s muster on your behalf.',
    href: '/muster',
    pushEligible: true,
  });
  return { ok: true, state: next, message: `Muster recorded on behalf of ${displayName(sailor)}.`, entityId: record.id };
}

export function overrideMuster(
  state: PrototypeState,
  actor: Sailor,
  sailorId: string,
  status: MusterStatus,
  deps: DomainDeps,
): Mutation {
  if (!hasRole(actor, 'COMMAND_CERTIFIER')) return fail('Only the command certifier can override a muster.');
  if (actor.id === sailorId) return fail('You cannot override your own muster.');
  const sailor = sailorById(state, sailorId);
  if (!sailor || sailor.commandId !== actor.commandId) return fail('Choose a Sailor in your command.');
  const timeZone = state.command.timezone;
  const today = todayInZone(timeZone, deps.now());
  const existing = currentMuster(state, sailorId, today);
  const at = stamp(deps);
  const note = `Overridden by the command certifier, ${displayName(actor)}.`;

  if (!existing) {
    const period = periodForDate(state, today);
    if (!period) return fail('No muster period is open for today.');
    const phase = periodPhase(period, deps.now(), timeZone, deps.forceDutyDay);
    if (phase === 'NOT_REQUIRED') return fail('Muster is not required today.');
    if (phase === 'UPCOMING' || phase === 'CLOSED') return fail('The muster window is not open.');
    const key = musterKey(sailorId, period.id, status);
    const record: MusterRecord = {
      id: deps.id('muster'),
      sailorId,
      commandId: sailor.commandId,
      uic: state.command.uic,
      periodId: period.id,
      reportingDate: today,
      status,
      statusOrigin: 'SAILOR_REPORTED',
      sourceSystem: 'MUSTER_SERVICE',
      linkedSnivRequestId: null,
      submittedAt: at,
      verification: 'VERIFIED',
      verificationActorId: actor.id,
      verifiedAt: at,
      syncState: 'VERIFIED_BY_COMMAND',
      idempotencyKey: key,
      createdAt: at,
      updatedAt: at,
      events: [
        {
          id: deps.id('muster-event'),
          at,
          actorId: actor.id,
          type: 'CERTIFIER_OVERRIDE',
          status,
          verification: 'VERIFIED',
          note,
          source: 'MUSTER_SERVICE',
          idempotencyKey: key,
        },
      ],
    };
    let created: PrototypeState = { ...state, musters: [record, ...state.musters] };
    created = pushAudit(created, deps, {
      actorId: actor.id,
      onBehalfOfId: sailorId,
      action: 'MUSTER_CERTIFIER_OVERRIDE',
      entityType: 'MusterRecord',
      entityId: record.id,
      previousState: null,
      newState: businessMusterState(record),
      metadata: { note },
    });
    created = pushNotification(created, deps, {
      recipientId: sailorId,
      kind: 'MUSTER_VERIFIED',
      title: 'Muster overridden',
      body: 'The command certifier recorded today’s muster for you. Open All Hands to review it.',
      href: '/muster',
      pushEligible: true,
    });
    return { ok: true, state: created, message: `Muster recorded for ${displayName(sailor)}.`, entityId: record.id };
  }

  const blocked = receivedMuster(existing);
  if (blocked) return fail(blocked);
  const key = musterKey(existing.sailorId, existing.periodId, status);
  const nextRecord: MusterRecord = {
    ...existing,
    status,
    verification: 'VERIFIED',
    verificationActorId: actor.id,
    verifiedAt: at,
    syncState: 'VERIFIED_BY_COMMAND',
    idempotencyKey: key,
    updatedAt: at,
    events: [
      ...existing.events,
      {
        id: deps.id('muster-event'),
        at,
        actorId: actor.id,
        type: 'CERTIFIER_OVERRIDE',
        status,
        verification: 'VERIFIED',
        note,
        source: 'MUSTER_SERVICE',
        idempotencyKey: key,
      },
    ],
  };
  let next = replaceMuster(state, nextRecord);
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: sailorId,
    action: 'MUSTER_CERTIFIER_OVERRIDE',
    entityType: 'MusterRecord',
    entityId: existing.id,
    previousState: businessMusterState(existing),
    newState: businessMusterState(nextRecord),
    metadata: { note },
  });
  next = pushNotification(next, deps, {
    recipientId: sailorId,
    kind: 'MUSTER_VERIFIED',
    title: 'Muster overridden',
    body: 'The command certifier updated today’s muster. Open All Hands to review it.',
    href: '/muster',
    pushEligible: true,
  });
  return { ok: true, state: next, message: `Muster overridden for ${displayName(sailor)}.`, entityId: existing.id };
}

export function flagMuster(state: PrototypeState, actor: Sailor, recordId: string, reason: string, deps: DomainDeps): Mutation {
  const note = reason.trim();
  if (note.length < 4) return fail('Enter a reason for the discrepancy.');
  const record = state.musters.find((item) => item.id === recordId);
  if (!record) return fail('Muster record not found.');
  if (!canVerifyMuster(state, actor, record.sailorId)) return fail('You are not authorized to flag this muster.');
  const blocked = receivedMuster(record);
  if (blocked) return fail(blocked);
  const at = stamp(deps);
  const nextRecord: MusterRecord = {
    ...record,
    verification: 'DISCREPANCY',
    verificationActorId: actor.id,
    verifiedAt: null,
    syncState: 'RECEIVED_BY_SERVICE',
    updatedAt: at,
    events: [
      ...record.events,
      {
        id: deps.id('muster-event'),
        at,
        actorId: actor.id,
        type: 'FLAGGED',
        status: record.status,
        verification: 'DISCREPANCY',
        note,
        source: 'MUSTER_SERVICE',
        idempotencyKey: record.idempotencyKey,
      },
    ],
  };
  let next = replaceMuster(state, nextRecord);
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: record.sailorId,
    action: 'MUSTER_FLAGGED',
    entityType: 'MusterRecord',
    entityId: record.id,
    previousState: businessMusterState(record),
    newState: businessMusterState(nextRecord),
    metadata: { reason: note },
  });
  next = pushNotification(next, deps, {
    recipientId: record.sailorId,
    kind: 'MUSTER_DISCREPANCY',
    title: 'Muster needs attention',
    body: 'Your command flagged today’s muster. Open All Hands to review the status.',
    href: '/muster',
    pushEligible: true,
  });
  return { ok: true, state: next, message: 'Discrepancy recorded.', entityId: record.id };
}

export function correctMuster(
  state: PrototypeState,
  actor: Sailor,
  recordId: string,
  status: MusterStatus,
  reason: string,
  deps: DomainDeps,
): Mutation {
  const note = reason.trim();
  if (note.length < 4) return fail('Enter the reason for this correction.');
  const record = state.musters.find((item) => item.id === recordId);
  if (!record) return fail('Muster record not found.');
  if (!canVerifyMuster(state, actor, record.sailorId)) return fail('You are not authorized to correct this muster.');
  const blocked = receivedMuster(record);
  if (blocked) return fail(blocked);
  const at = stamp(deps);
  const key = musterKey(record.sailorId, record.periodId, status);
  const nextRecord: MusterRecord = {
    ...record,
    status,
    statusOrigin: 'SAILOR_REPORTED',
    verification: 'VERIFIED',
    verificationActorId: actor.id,
    verifiedAt: at,
    syncState: 'VERIFIED_BY_COMMAND',
    idempotencyKey: key,
    updatedAt: at,
    events: [
      ...record.events,
      {
        id: deps.id('muster-event'),
        at,
        actorId: actor.id,
        type: 'SUPERVISOR_CORRECTION',
        status,
        verification: 'VERIFIED',
        note,
        source: 'MUSTER_SERVICE',
        idempotencyKey: key,
      },
    ],
  };
  let next = replaceMuster(state, nextRecord);
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: record.sailorId,
    action: 'MUSTER_SUPERVISOR_CORRECTION',
    entityType: 'MusterRecord',
    entityId: record.id,
    previousState: businessMusterState(record),
    newState: businessMusterState(nextRecord),
    metadata: { reason: note },
  });
  next = pushNotification(next, deps, {
    recipientId: record.sailorId,
    kind: 'MUSTER_DISCREPANCY',
    title: 'Muster updated by your command',
    body: 'Your command corrected today’s muster. Open All Hands to review it.',
    href: '/muster',
    pushEligible: true,
  });
  return { ok: true, state: next, message: 'Correction recorded with your name.', entityId: record.id };
}

function replaceMuster(state: PrototypeState, record: MusterRecord): PrototypeState {
  return { ...state, musters: state.musters.map((item) => (item.id === record.id ? record : item)) };
}

export function planAbsence(state: PrototypeState, input: SnivInput): { minutes: number } | { error: string } {
  const minutes = intervalMinutes(input.date, input.endDate, input.startTime, input.endTime, state.command.timezone);
  if (minutes === null) return { error: 'Enter a valid date and time.' };
  if (minutes <= 0) {
    return {
      error: 'Return time must be after the start time. If the absence continues past midnight, set the return date to the next day.',
    };
  }
  if (minutes > 18 * 60) {
    return { error: 'This form is for part of a duty day. For a longer absence, use the leave process.' };
  }
  return { minutes };
}

function snivBusiness(request: Pick<SnivRequest, 'status' | 'syncState'>): string {
  return `${request.status}:${request.syncState}`;
}

export function saveSnivDraft(state: PrototypeState, actor: Sailor, input: SnivInput, deps: DomainDeps): Mutation {
  const built = buildSniv(state, actor, input, 'DRAFT', deps);
  if (!built.ok) return built;
  return built;
}

function expandSnivDates(timeZone: string, input: SnivInput): { dates: string[] } | { error: string } {
  const mode = input.recurrence ?? 'NONE';
  if (mode === 'NONE' || input.requestId) return { dates: [input.date] };
  if (!input.untilDate) return { error: 'Enter an until date for a recurring sniv.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.untilDate)) return { error: 'Use YYYY-MM-DD for the until date.' };
  if (input.untilDate < input.date) return { error: 'The until date must be on or after the start date.' };
  const dates: string[] = [];
  const step = mode === 'WEEKLY' ? 7 : 1;
  let cursor = input.date;
  while (cursor <= input.untilDate) {
    const weekday = weekdayIndex(cursor, timeZone);
    const include = mode === 'DAILY' || mode === 'WEEKLY' || (weekday >= 1 && weekday <= 5);
    if (include) {
      if (dates.length === 16) return { error: 'A recurring sniv can include up to 16 dates. Shorten the until date.' };
      dates.push(cursor);
    }
    cursor = addDays(cursor, step);
  }
  if (dates.length === 0) return { error: 'No dates fall in that recurrence.' };
  return { dates };
}

export function submitSniv(state: PrototypeState, actor: Sailor, input: SnivInput, deps: DomainDeps): Mutation {
  const expanded = expandSnivDates(state.command.timezone, input);
  if ('error' in expanded) return fail(expanded.error);
  if (expanded.dates.length === 1) return buildSniv(state, actor, input, 'PENDING_APPROVAL', deps);
  let next = state;
  for (const date of expanded.dates) {
    const result = buildSniv(
      next,
      actor,
      { ...input, date, endDate: date, requestId: undefined, recurrence: 'NONE', untilDate: undefined },
      'PENDING_APPROVAL',
      deps,
    );
    if (!result.ok) return result;
    next = result.state;
  }
  return { ok: true, state: next, message: `Submitted ${expanded.dates.length} sniv requests for approval.` };
}

function buildSniv(
  state: PrototypeState,
  actor: Sailor,
  input: SnivInput,
  target: 'DRAFT' | 'PENDING_APPROVAL',
  deps: DomainDeps,
): Mutation {
  if (!state.command.snivCategories.includes(input.category)) return fail('That category is not available for your command.');
  const categoryNote = input.categoryNote?.trim() ?? '';
  if (input.category === 'OTHER' && categoryNote.length < 3) return fail('Describe the other category.');
  if (categoryNote.length > 80) return fail('Keep the other category under 80 characters.');
  const planned = planAbsence(state, input);
  if ('error' in planned) return fail(planned.error);
  if (input.remarks.trim().length > 240) return fail('Keep remarks under 240 characters. Do not include medical details.');
  const supervisor = supervisorFor(state, actor.id);
  if (!supervisor) return fail('No supervisor is on file, so this request cannot be routed.');
  const existing = input.requestId ? state.snivRequests.find((item) => item.id === input.requestId) : undefined;
  if (input.requestId && !existing) return fail('Request not found.');
  if (existing && existing.sailorId !== actor.id) return fail('You cannot change another person’s request.');
  if (target === 'DRAFT' && existing && existing.status !== 'DRAFT') {
    return fail('Only a draft can be saved without submitting.');
  }
  if (existing && !['DRAFT', 'RETURNED', 'APPROVED', 'PENDING_APPROVAL'].includes(existing.status)) {
    return fail('This request can no longer be edited.');
  }
  if (existing?.status === 'APPROVED' && target === 'DRAFT') return fail('An approved request cannot return to draft.');
  if (existing?.status === 'PENDING_APPROVAL' && existing.syncState === 'RECEIVED_BY_SERVICE' && target === 'PENDING_APPROVAL') {
    return fail('This request is already with your supervisor. Cancel it if you need to replace it.');
  }

  const at = stamp(deps);
  const syncState: SyncState = target === 'DRAFT' ? 'SAVED_ON_DEVICE' : deps.online ? 'RECEIVED_BY_SERVICE' : 'QUEUED_FOR_SUBMISSION';
  const resubmit = existing?.status === 'APPROVED' || existing?.status === 'RETURNED';
  const action: 'DRAFT_SAVED' | 'RESUBMITTED' | 'SUBMITTED' = target === 'DRAFT' ? 'DRAFT_SAVED' : resubmit ? 'RESUBMITTED' : 'SUBMITTED';
  const approval = {
    id: deps.id('approval'),
    at,
    actorId: actor.id,
    action,
    note: input.remarks.trim() || null,
    previousStatus: existing?.status ?? null,
    newStatus: target as SnivStatus,
  };
  const request: SnivRequest = {
    id: existing?.id ?? deps.id('sniv'),
    sailorId: actor.id,
    commandId: actor.commandId,
    supervisorId: supervisor.id,
    category: input.category,
    date: input.date,
    endDate: input.endDate,
    startTime: input.startTime,
    endTime: input.endTime,
    durationMinutes: planned.minutes,
    remarks: input.remarks.trim(),
    categoryNote: categoryNote || undefined,
    status: target,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
    submittedAt: target === 'DRAFT' ? existing?.submittedAt ?? null : at,
    sourceSystem: 'SNIV_WORKFLOW',
    syncState,
    idempotencyKey: `sniv:${actor.id}:${input.date}:${input.startTime}:${input.endTime}:${input.category}:${target}`,
    approvals: [...(existing?.approvals ?? []), approval],
  };
  let next: PrototypeState = {
    ...state,
    snivRequests: existing
      ? state.snivRequests.map((item) => (item.id === existing.id ? request : item))
      : [request, ...state.snivRequests],
  };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: target === 'DRAFT' ? 'SNIV_DRAFT_SAVED' : resubmit ? 'SNIV_RESUBMITTED' : 'SNIV_SUBMITTED',
    entityType: 'SnivRequest',
    entityId: request.id,
    previousState: existing ? snivBusiness(existing) : null,
    newState: snivBusiness(request),
    metadata: {},
  });
  if (target === 'PENDING_APPROVAL' && !deps.online) {
    next = queue(next, deps, {
      idempotencyKey: request.idempotencyKey,
      kind: 'SNIV',
      entityId: request.id,
      sailorId: actor.id,
      baselineUpdatedAt: at,
    });
  }
  if (target === 'PENDING_APPROVAL' && deps.online) {
    next = pushNotification(next, deps, {
      recipientId: supervisor.id,
      kind: 'SNIV_SUBMITTED',
      title: 'Time-away request to review',
      body: 'A time-away request is waiting for your review.',
      href: '/team/approvals',
      pushEligible: true,
    });
  }
  const when = `${input.date} ${formatMilitary(input.startTime)}–${formatMilitary(input.endTime)}`;
  const message =
    target === 'DRAFT'
      ? 'Draft saved on this device.'
      : deps.online
        ? `Your request for ${when} has been sent for approval.`
        : 'Request queued on this device. Your supervisor has not received it.';
  return { ok: true, state: next, message, entityId: request.id };
}

export function approveSniv(state: PrototypeState, actor: Sailor, requestId: string, deps: DomainDeps): Mutation {
  return decideSniv(state, actor, requestId, 'APPROVED', null, deps);
}

export function denySniv(state: PrototypeState, actor: Sailor, requestId: string, reason: string, deps: DomainDeps): Mutation {
  if (reason.trim().length < 4) return fail('Enter a reason for the denial.');
  return decideSniv(state, actor, requestId, 'DENIED', reason.trim(), deps);
}

export function returnSniv(state: PrototypeState, actor: Sailor, requestId: string, reason: string, deps: DomainDeps): Mutation {
  if (reason.trim().length < 4) return fail('Tell the Sailor what information you need.');
  return decideSniv(state, actor, requestId, 'RETURNED', reason.trim(), deps);
}

function decideSniv(
  state: PrototypeState,
  actor: Sailor,
  requestId: string,
  status: 'APPROVED' | 'DENIED' | 'RETURNED',
  note: string | null,
  deps: DomainDeps,
): Mutation {
  const request = state.snivRequests.find((item) => item.id === requestId);
  if (!request) return fail('Request not found.');
  if (request.sailorId === actor.id) return fail('You cannot approve your own request.');
  if (!hasRole(actor, 'SUPERVISOR')) return fail('You are not authorized to decide this request.');
  if (request.supervisorId !== actor.id) return fail('You are not the assigned supervisor for this request.');
  if (request.syncState !== 'RECEIVED_BY_SERVICE') {
    return fail('This request has not been received, so it cannot be decided.');
  }
  if (request.status !== 'PENDING_APPROVAL') return fail('Only a pending request can be decided.');
  const at = stamp(deps);
  const action = status === 'APPROVED' ? 'APPROVED' : status === 'DENIED' ? 'DENIED' : 'RETURNED';
  const updated: SnivRequest = {
    ...request,
    status,
    updatedAt: at,
    syncState: 'VERIFIED_BY_COMMAND',
    approvals: [
      ...request.approvals,
      {
        id: deps.id('approval'),
        at,
        actorId: actor.id,
        action,
        note,
        previousStatus: request.status,
        newStatus: status,
      },
    ],
  };
  let next: PrototypeState = {
    ...state,
    snivRequests: state.snivRequests.map((item) => (item.id === request.id ? updated : item)),
  };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: request.sailorId,
    action: status === 'APPROVED' ? 'SNIV_APPROVED' : status === 'DENIED' ? 'SNIV_DENIED' : 'SNIV_RETURNED',
    entityType: 'SnivRequest',
    entityId: request.id,
    previousState: snivBusiness(request),
    newState: snivBusiness(updated),
    metadata: note ? { reason: note } : {},
  });
  const window = `${request.date}, ${formatMilitary(request.startTime)}–${formatMilitary(request.endTime)}`;
  const copy =
    status === 'APPROVED'
      ? { kind: 'SNIV_APPROVED' as NotificationKind, title: 'Time-away request approved', body: `Your request for ${window} was approved.` }
      : status === 'DENIED'
        ? { kind: 'SNIV_DENIED' as NotificationKind, title: 'Time-away request denied', body: `Your request for ${window} was denied. Open My Requests for the reason.` }
        : { kind: 'SNIV_RETURNED' as NotificationKind, title: 'Time-away request needs information', body: `Your request for ${window} was returned. Open My Requests to respond.` };
  next = pushNotification(next, deps, {
    recipientId: request.sailorId,
    kind: copy.kind,
    title: copy.title,
    body: copy.body,
    href: `/requests/${request.id}`,
    pushEligible: true,
  });
  return { ok: true, state: next, message: status === 'APPROVED' ? 'Request approved.' : status === 'DENIED' ? 'Request denied.' : 'Request returned for information.', entityId: request.id };
}

export function cancelSniv(state: PrototypeState, actor: Sailor, requestId: string, deps: DomainDeps): Mutation {
  const request = state.snivRequests.find((item) => item.id === requestId);
  if (!request) return fail('Request not found.');
  if (request.sailorId !== actor.id) return fail('You can only cancel your own request.');
  if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RETURNED'].includes(request.status)) {
    return fail('This request cannot be cancelled.');
  }
  const at = stamp(deps);
  const queuedOnly = request.syncState === 'QUEUED_FOR_SUBMISSION' || request.syncState === 'SAVED_ON_DEVICE';
  const updated: SnivRequest = {
    ...request,
    status: 'CANCELLED',
    updatedAt: at,
    syncState: queuedOnly ? 'SAVED_ON_DEVICE' : 'RECEIVED_BY_SERVICE',
    approvals: [
      ...request.approvals,
      {
        id: deps.id('approval'),
        at,
        actorId: actor.id,
        action: 'CANCELLED',
        note: queuedOnly ? 'Discarded before the supervisor received it.' : null,
        previousStatus: request.status,
        newStatus: 'CANCELLED',
      },
    ],
  };
  let next: PrototypeState = {
    ...state,
    snivRequests: state.snivRequests.map((item) => (item.id === request.id ? updated : item)),
    outbox: state.outbox.map((item) =>
      item.entityId === request.id && item.status === 'QUEUED'
        ? { ...item, status: 'SYNCED', conflictNote: 'Cancelled before transmission.' }
        : item,
    ),
  };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: 'SNIV_CANCELLED',
    entityType: 'SnivRequest',
    entityId: request.id,
    previousState: snivBusiness(request),
    newState: snivBusiness(updated),
    metadata: {},
  });
  if (!queuedOnly && request.status !== 'DRAFT') {
    next = pushNotification(next, deps, {
      recipientId: request.supervisorId,
      kind: 'SNIV_CANCELLED',
      title: 'Time-away request cancelled',
      body: 'A Sailor cancelled a time-away request that had been routed to you.',
      href: '/team/approvals',
      pushEligible: true,
    });
  }
  return {
    ok: true,
    state: next,
    message: queuedOnly ? 'The queued request was discarded on this device. Your supervisor never received it.' : 'Request cancelled.',
    entityId: request.id,
  };
}

export function listDependents(state: PrototypeState, actor: Sailor, sponsorId: string): Result<PrototypeState['dependents']> {
  if (actor.id !== sponsorId) {
    return { ok: false, error: 'You are not authorized to view these family details.' };
  }
  return { ok: true, value: state.dependents.filter((item) => item.sponsorId === sponsorId) };
}

export function activeEmergency(state: PrototypeState): EmergencyEvent | undefined {
  return state.emergencies.find((event) => event.active && event.origin !== 'SAILOR' && event.commandIds.includes(state.command.id));
}

export function familyEventFor(state: PrototypeState, sponsorId: string): EmergencyEvent | undefined {
  return (
    activeEmergency(state) ??
    state.emergencies.find((event) => event.active && event.origin === 'SAILOR' && event.sponsorId === sponsorId)
  );
}

export function updateDependentContact(
  state: PrototypeState,
  actor: Sailor,
  dependentId: string,
  phone: string,
  address: string,
): Mutation {
  const nextPhone = phone.trim();
  const nextAddress = address.trim();
  if (nextPhone.length < 7) return fail('Enter a phone number for this dependent.');
  if (nextAddress.length < 8) return fail('Enter a street address for this dependent.');
  const dependent = state.dependents.find((item) => item.id === dependentId);
  if (!dependent) return fail('Dependent not found.');
  if (dependent.sponsorId !== actor.id) return fail('You can edit contact information only for your own dependents.');
  return {
    ok: true,
    state: {
      ...state,
      dependents: state.dependents.map((item) =>
        item.id === dependentId
          ? { ...item, phone: nextPhone, address: nextAddress, contactSummary: `${nextPhone} · ${nextAddress}` }
          : item,
      ),
    },
    message: 'Contact information saved.',
    entityId: dependentId,
  };
}

export function submitDependentStatus(
  state: PrototypeState,
  actor: Sailor,
  dependentId: string,
  status: Exclude<FamilyStatus, 'NOT_REPORTED'>,
  location: string,
  remarks: string,
  deps: DomainDeps,
): Mutation {
  const event = familyEventFor(state, actor.id);
  if (!event) return fail('Open a request for help, or wait for the Navy to open accountability, before submitting status.');
  const mine = state.dependents.filter((item) => item.sponsorId === actor.id);
  const target = mine.find((item) => item.id === dependentId);
  if (!target) return fail('Dependent not found.');
  const area = location.trim();
  const note = remarks.trim();
  if (area.length < 2) return fail('Enter the address the command should use for this dependent.');
  if (note.length > 280) return fail('Keep remarks under 280 characters.');
  const dependents = state.dependents.map((item) =>
    item.id === dependentId ? { ...item, currentStatus: status, statusLocation: area, address: area } : item,
  );
  const members: FamilyMemberReport[] = mine.map((person) => {
    const current = person.id === dependentId ? status : (person.currentStatus ?? 'UNKNOWN');
    const general = person.id === dependentId ? area : (person.statusLocation ?? person.address ?? '');
    const needsLocation = current === 'DISPLACED' || current === 'NEEDS_ASSISTANCE';
    return {
      dependentId: person.id,
      status: current,
      generalLocation: needsLocation ? general || null : general || null,
      safeContact: null,
      needs: current === 'NEEDS_ASSISTANCE' ? ['OTHER'] : [],
      context: person.id === dependentId ? note : '',
    };
  });
  const missing = members.find((member) => (member.status === 'DISPLACED' || member.status === 'NEEDS_ASSISTANCE') && !member.generalLocation);
  if (missing) {
    const person = mine.find((item) => item.id === missing.dependentId);
    return fail(`Enter a general area for ${person?.firstName ?? 'each dependent'} before submitting.`);
  }
  return submitFamily({ ...state, dependents }, actor, event.id, members, deps);
}

export function updateWorkCenterSettings(
  state: PrototypeState,
  actor: Sailor,
  input: WorkCenterSettingsInput,
  deps: DomainDeps,
): Mutation {
  if (rosterScope(actor) === 'NONE') return fail('Only a supervisor can change work center settings.');
  if (!/^\d{2}:\d{2}$/.test(input.musterBy)) return fail('Enter the muster time as HH:MM.');
  const [hour, minute] = input.musterBy.split(':').map(Number);
  if (hour > 23 || minute > 59 || Number.isNaN(hour) || Number.isNaN(minute)) return fail('Enter a valid muster time.');
  const dutyDays = [...new Set(input.dutyDays)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
  if (dutyDays.length === 0) return fail('Select at least one day that requires muster.');
  const holidays = [...new Set(input.holidays.map((day) => day.trim()))].filter(Boolean).sort();
  if (holidays.some((day) => !/^\d{4}-\d{2}-\d{2}$/.test(day))) return fail('Enter holidays as YYYY-MM-DD.');

  const command: Command = {
    ...state.command,
    musterPolicy: {
      ...state.command.musterPolicy,
      primaryWindowEnd: input.musterBy,
      dutyDays,
      holidays,
    },
  };
  const periods = state.periods.map((period) => makePeriod(command, period.reportingDate));
  let next: PrototypeState = { ...state, command, periods };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: 'WORK_CENTER_SETTINGS_UPDATED',
    entityType: 'Command',
    entityId: command.id,
    previousState: state.command.musterPolicy.primaryWindowEnd,
    newState: input.musterBy,
    metadata: {
      dutyDays: dutyDays.join(','),
      holidays: holidays.join(','),
    },
  });
  return { ok: true, state: next, message: 'Work center settings saved.', entityId: command.id };
}

export function startSailorAccountability(state: PrototypeState, actor: Sailor, deps: DomainDeps, summary?: string): Mutation {
  if (state.dependents.every((item) => item.sponsorId !== actor.id)) return fail('No dependents are registered for you.');
  if (activeEmergency(state)) return fail('The Navy has already opened accountability for the command.');
  const existing = state.emergencies.find((event) => event.origin === 'SAILOR' && event.sponsorId === actor.id);
  const at = stamp(deps);
  const text = summary?.trim() || `${displayName(actor)} asked for help accounting for dependents.`;
  if (existing?.active) {
    const emergencies = state.emergencies.map((event) => (event.id === existing.id ? { ...event, summary: text } : event));
    return { ok: true, state: { ...state, emergencies }, message: 'Your request for help is updated.', entityId: existing.id };
  }
  const opened: EmergencyEvent = {
    id: existing?.id ?? deps.id('event'),
    name: 'Request for help',
    kind: 'OTHER',
    summary: text,
    commandIds: [actor.commandId],
    active: true,
    activatable: true,
    activatedAt: at,
    closedAt: null,
    sourceSystem: 'NFAAS_SIMULATION',
    origin: 'SAILOR',
    sponsorId: actor.id,
  };
  const emergencies = existing
    ? state.emergencies.map((event) => (event.id === existing.id ? opened : event))
    : [opened, ...state.emergencies];
  let next: PrototypeState = { ...state, emergencies };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: 'FAMILY_HELP_REQUESTED',
    entityType: 'EmergencyEvent',
    entityId: opened.id,
    previousState: existing ? 'INACTIVE' : null,
    newState: 'ACTIVE',
    metadata: { origin: 'SAILOR' },
  });
  return { ok: true, state: next, message: 'Request for help opened. Report each dependent.', entityId: opened.id };
}

export function submitSelfHelp(
  state: PrototypeState,
  actor: Sailor,
  input: { kind: SelfHelpKind; detail: string; notifySupervisor: boolean; subject: HelpSubject; shipmateId: string | null; shipmateName?: string | null },
  deps: DomainDeps,
): Mutation {
  const quiet = input.kind === 'CRISIS' || input.kind === 'SAPR';
  const detail = quiet ? '' : input.detail.trim();
  const typedName = input.shipmateName?.trim() ?? '';
  const shipmate = input.shipmateId ? sailorById(state, input.shipmateId) : undefined;
  if (input.subject !== 'MYSELF') {
    if (input.shipmateId && (!shipmate || shipmate.id === actor.id || shipmate.commandId !== actor.commandId)) {
      return fail('Choose a shipmate in your command.');
    }
    if (!shipmate && typedName.length < 2) return fail('Enter a shipmate or choose one from your command.');
  }
  const shipmateName = input.subject === 'MYSELF' ? null : typedName || (shipmate ? displayName(shipmate) : null);
  if (input.kind === 'UNABLE_TO_REACH' && !shipmateName) return fail('Enter the shipmate you cannot reach.');
  if (input.kind === 'OTHER' && detail.length < 3) return fail('Say what help is needed. Do not describe the incident.');
  if ((input.kind === 'RIDE' || input.kind === 'MEDICAL') && detail.length < 2) return fail('Choose the detail that applies.');
  const supervisor = supervisorFor(state, actor.id);
  const summary = summarizeSelfHelp({
    kind: input.kind,
    detail,
    notifySupervisor: input.notifySupervisor,
    subject: input.subject,
    shipmateName,
  });
  const request: SelfHelpRequest = {
    id: deps.id('self-help'),
    sailorId: actor.id,
    supervisorId: supervisor?.id ?? null,
    subject: input.subject,
    shipmateId: shipmate?.id ?? null,
    shipmateName,
    kind: input.kind,
    summary,
    createdAt: stamp(deps),
  };
  let next: PrototypeState = { ...state, selfHelpRequests: [request, ...(state.selfHelpRequests ?? [])] };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: shipmate && input.subject === 'SHIPMATE' ? shipmate.id : actor.id,
    action: 'SELF_HELP_REQUESTED',
    entityType: 'SelfHelpRequest',
    entityId: request.id,
    previousState: null,
    newState: input.kind,
    metadata: { notifySupervisor: input.notifySupervisor ? 'true' : 'false', subject: input.subject },
  });
  if (input.notifySupervisor && supervisor) {
    const forShipmate = input.subject !== 'MYSELF';
    next = pushNotification(next, deps, {
      recipientId: supervisor.id,
      kind: 'ASSISTANCE_FOLLOWUP',
      title: quiet ? 'Sailor asked for a check-in' : forShipmate ? 'Help requested for a shipmate' : 'Sailor asked for help',
      body: quiet ? `${displayName(actor)} asked you to make contact. No further detail was provided.` : summary,
      href: '/team',
      pushEligible: true,
    });
  }
  return { ok: true, state: next, message: 'Help request submitted.', entityId: request.id };
}

export function submitFamilyHelp(
  state: PrototypeState,
  actor: Sailor,
  input: { dependentIds: string[]; kind: FamilyHelpKind; location: string; remarks: string },
  deps: DomainDeps,
): Mutation {
  const mine = state.dependents.filter((item) => item.sponsorId === actor.id);
  const chosen = mine.filter((person) => input.dependentIds.includes(person.id));
  if (chosen.length === 0) return fail('Choose at least one dependent.');
  const location = input.location.trim();
  const remarks = input.remarks.trim();
  if (location.length < 4) return fail('Enter where they are.');
  if (remarks.length > 280) return fail('Keep remarks under 280 characters.');
  const summary = summarizeFamilyHelp(
    input.kind,
    chosen.map((person) => `${person.firstName} ${person.lastName}`),
    location,
    remarks,
  );
  const request: FamilyHelpRequest = {
    id: deps.id('family-help'),
    sponsorId: actor.id,
    dependentIds: chosen.map((person) => person.id),
    kind: input.kind,
    location,
    remarks,
    summary,
    createdAt: stamp(deps),
  };
  let next: PrototypeState = { ...state, familyHelpRequests: [request, ...(state.familyHelpRequests ?? [])] };
  if (activeEmergency(next)) {
    next = pushAudit(next, deps, {
      actorId: actor.id,
      onBehalfOfId: actor.id,
      action: 'FAMILY_HELP_REQUESTED',
      entityType: 'FamilyHelpRequest',
      entityId: request.id,
      previousState: 'COMMAND_EVENT_OPEN',
      newState: input.kind,
      metadata: { summary },
    });
    return { ok: true, state: next, message: 'The Navy already has accountability open. Your help request was sent with the details you entered.', entityId: request.id };
  }
  const opened = startSailorAccountability(next, actor, deps, summary);
  if (!opened.ok) return opened;
  return { ok: true, state: opened.state, message: 'Request for help submitted.', entityId: request.id };
}

export function pushCommandAccountability(state: PrototypeState, actor: Sailor, open: boolean, deps: DomainDeps): Mutation {
  if (!hasRole(actor, 'COMMAND_CERTIFIER')) return fail('Only the command certification authority can open a Navy accountability event.');
  const at = stamp(deps);
  const existing = state.emergencies.find((event) => event.id === 'event-command');
  if (open && existing?.active) return { ok: true, state, message: 'Command accountability is already open.', entityId: existing.id };
  if (!open && !existing?.active) return { ok: true, state, message: 'Command accountability is already closed.', entityId: existing?.id };
  const opened: EmergencyEvent = {
    id: 'event-command',
    name: 'Navy accountability',
    kind: 'OTHER',
    summary: 'The command requires every Sailor to validate their own status and their family’s status.',
    commandIds: [state.command.id],
    active: open,
    activatable: true,
    activatedAt: open ? at : existing?.activatedAt ?? null,
    closedAt: open ? null : at,
    sourceSystem: 'NFAAS_SIMULATION',
    origin: 'COMMAND',
    sponsorId: null,
  };
  const emergencies = existing
    ? state.emergencies.map((event) => (event.id === existing.id ? opened : event))
    : [opened, ...state.emergencies];
  let next: PrototypeState = { ...state, emergencies };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: open ? 'COMMAND_ACCOUNTABILITY_OPENED' : 'COMMAND_ACCOUNTABILITY_CLOSED',
    entityType: 'EmergencyEvent',
    entityId: opened.id,
    previousState: existing?.active ? 'ACTIVE' : 'INACTIVE',
    newState: open ? 'ACTIVE' : 'INACTIVE',
    metadata: { origin: 'COMMAND' },
  });
  if (open) {
    for (const sailor of state.sailors.filter((item) => item.commandId === state.command.id)) {
      next = pushNotification(next, deps, {
        recipientId: sailor.id,
        kind: 'EMERGENCY_ACTIVATED',
        title: 'Navy accountability',
        body: 'Validate your own status and your family’s status. The command needs every Sailor and every family accounted for.',
        href: '/family',
        pushEligible: true,
      });
    }
  }
  return {
    ok: true,
    state: next,
    message: open
      ? 'Navy accountability is open. The command was notified to validate personnel and families.'
      : 'Navy accountability is closed.',
    entityId: opened.id,
  };
}

export function setShareLocation(state: PrototypeState, actor: Sailor, mode: ShareLocation): Mutation {
  const mine = state.dependents.filter((item) => item.sponsorId === actor.id);
  if (mine.length === 0) return fail('No dependents are registered for you.');
  const household = (state.households ?? []).find((item) => item.sponsorId === actor.id);
  const spouse = mine.find((item) => item.relationship === 'SPOUSE');
  let dependents = state.dependents;
  if (mode === 'SAILOR') {
    if (!household || household.address.trim().length < 8) return fail('Add your address before sharing it with the family.');
    dependents = dependents.map((item) => (item.sponsorId === actor.id ? { ...item, address: household.address.trim() } : item));
  }
  if (mode === 'SPOUSE') {
    if (!spouse || spouse.address.trim().length < 8) return fail('Add the spouse address before sharing it with the family.');
    dependents = dependents.map((item) =>
      item.sponsorId === actor.id && item.id !== spouse.id ? { ...item, address: spouse.address.trim() } : item,
    );
  }
  const nextHousehold = {
    sponsorId: actor.id,
    phone: household?.phone ?? '',
    address: household?.address ?? '',
    shareLocation: mode,
  };
  const households = household
    ? (state.households ?? []).map((item) => (item.sponsorId === actor.id ? nextHousehold : item))
    : [nextHousehold, ...(state.households ?? [])];
  const message =
    mode === 'SAILOR'
      ? 'Your address was copied to each dependent.'
      : mode === 'SPOUSE'
        ? 'The spouse address was copied to the rest of the family.'
        : 'Each dependent keeps their own address.';
  return { ok: true, state: { ...state, dependents, households }, message };
}

export function updateHousehold(state: PrototypeState, actor: Sailor, phone: string, address: string): Mutation {
  const nextPhone = phone.trim();
  const nextAddress = address.trim();
  if (nextPhone.length < 7) return fail('Enter your phone number.');
  if (nextAddress.length < 8) return fail('Enter your street address.');
  const household = (state.households ?? []).find((item) => item.sponsorId === actor.id);
  const next = { sponsorId: actor.id, phone: nextPhone, address: nextAddress, shareLocation: household?.shareLocation ?? 'OWN' };
  let dependents = state.dependents;
  if (next.shareLocation === 'SAILOR') {
    dependents = dependents.map((item) => (item.sponsorId === actor.id ? { ...item, address: nextAddress } : item));
  }
  const households = household
    ? (state.households ?? []).map((item) => (item.sponsorId === actor.id ? next : item))
    : [next, ...(state.households ?? [])];
  return { ok: true, state: { ...state, dependents, households }, message: 'Your contact information saved.' };
}

export function accountForFamily(state: PrototypeState, actor: Sailor, accounted: boolean, deps: DomainDeps): Mutation {
  const mine = state.dependents.filter((item) => item.sponsorId === actor.id);
  if (mine.length === 0) return fail('No dependents are registered for you.');
  const status: 'SAFE' | 'UNKNOWN' = accounted ? 'SAFE' : 'UNKNOWN';
  const dependents = state.dependents.map((item) =>
    item.sponsorId === actor.id ? { ...item, currentStatus: status, statusLocation: accounted ? item.address : item.statusLocation } : item,
  );
  const event = familyEventFor({ ...state, dependents }, actor.id);
  if (!event) {
    return { ok: true, state: { ...state, dependents }, message: accounted ? 'Family marked accounted for.' : 'Family accounting cleared.' };
  }
  const members: FamilyMemberReport[] = mine.map((person) => ({
    dependentId: person.id,
    status,
    generalLocation: null,
    safeContact: null,
    needs: [],
    context: '',
  }));
  const reported = submitFamily({ ...state, dependents }, actor, event.id, members, deps);
  if (!reported.ok) return reported;
  return { ...reported, message: accounted ? 'Family marked accounted for.' : 'Family accounting cleared.' };
}

export function certifyCommand(state: PrototypeState, actor: Sailor, deps: DomainDeps): Mutation {
  if (!hasRole(actor, 'COMMAND_CERTIFIER')) return fail('Only the command certification authority can certify the command muster.');
  const today = todayInZone(state.command.timezone, deps.now());
  const period = periodForDate(state, today);
  if (!period?.required) return fail('Muster is not required today.');
  if ((state.commandCertifications ?? []).some((item) => item.commandId === state.command.id && item.reportingDate === today)) {
    return fail('Today’s command muster is already certified.');
  }
  const outstanding: string[] = [];
  let confirmed = 0;
  for (const sailor of state.sailors.filter((item) => item.commandId === actor.commandId)) {
    const record = currentMuster(state, sailor.id, today);
    if (record?.verification === 'VERIFIED') confirmed += 1;
    else outstanding.push(displayName(sailor));
  }
  const certification: CommandCertification = {
    id: deps.id('cert'),
    commandId: state.command.id,
    reportingDate: today,
    certifiedBy: actor.id,
    certifiedAt: stamp(deps),
    confirmed,
    outstanding,
  };
  let next: PrototypeState = {
    ...state,
    commandCertifications: [certification, ...(state.commandCertifications ?? [])],
  };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: 'COMMAND_MUSTER_CERTIFIED',
    entityType: 'CommandCertification',
    entityId: certification.id,
    previousState: null,
    newState: `${confirmed} confirmed, ${outstanding.length} outstanding`,
    metadata: {},
  });
  const held = outstanding.length > 0 ? ` ${outstanding.length} still outstanding.` : '';
  return { ok: true, state: next, message: `Command muster certified. ${confirmed} confirmed.${held}`, entityId: certification.id };
}

export function activateEmergency(state: PrototypeState, actor: Sailor, eventId: string, deps: DomainDeps): Mutation {
  if (!hasRole(actor, 'MUSTER_COORDINATOR') && !hasRole(actor, 'COMMAND_LEADERSHIP')) {
    return fail('Only a muster coordinator or command leadership can activate an emergency event.');
  }
  const event = state.emergencies.find((item) => item.id === eventId);
  if (!event) return fail('Emergency event not found.');
  if (!event.activatable) return fail('This closed event cannot be reactivated from the prototype.');
  if (event.active) return { ok: true, state, message: 'The event is already active.', entityId: event.id };
  if (state.emergencies.some((item) => item.active)) return fail('Close the current event before activating another.');
  const at = stamp(deps);
  const updated: EmergencyEvent = { ...event, active: true, activatedAt: at, closedAt: null };
  let next: PrototypeState = {
    ...state,
    emergencies: state.emergencies.map((item) => (item.id === event.id ? updated : item)),
  };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: 'EMERGENCY_ACTIVATED',
    entityType: 'EmergencyEvent',
    entityId: event.id,
    previousState: 'INACTIVE',
    newState: 'ACTIVE',
    metadata: { source: 'NFAAS_SIMULATION' },
  });
  for (const sailor of state.sailors.filter((item) => event.commandIds.includes(item.commandId))) {
    next = pushNotification(next, deps, {
      recipientId: sailor.id,
      kind: 'EMERGENCY_ACTIVATED',
      title: 'Family accountability required',
      body: 'An emergency accountability event is active for your area. Open Family to report status. This alert does not include family details.',
      href: '/family/account',
      pushEligible: true,
    });
  }
  return { ok: true, state: next, message: `${event.name} is active for this command.`, entityId: event.id };
}

export function deactivateEmergency(state: PrototypeState, actor: Sailor, eventId: string, deps: DomainDeps): Mutation {
  if (!hasRole(actor, 'MUSTER_COORDINATOR') && !hasRole(actor, 'COMMAND_LEADERSHIP')) {
    return fail('Only a muster coordinator or command leadership can close an emergency event.');
  }
  const event = state.emergencies.find((item) => item.id === eventId);
  if (!event) return fail('Emergency event not found.');
  if (!event.active) return { ok: true, state, message: 'The event is already closed.', entityId: event.id };
  const at = stamp(deps);
  const updated: EmergencyEvent = { ...event, active: false, closedAt: at };
  let next: PrototypeState = {
    ...state,
    emergencies: state.emergencies.map((item) => (item.id === event.id ? updated : item)),
  };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: 'EMERGENCY_CLOSED',
    entityType: 'EmergencyEvent',
    entityId: event.id,
    previousState: 'ACTIVE',
    newState: 'INACTIVE',
    metadata: {},
  });
  for (const sailor of state.sailors.filter((item) => event.commandIds.includes(item.commandId))) {
    next = pushNotification(next, deps, {
      recipientId: sailor.id,
      kind: 'EVENT_UPDATED',
      title: 'Emergency event updated',
      body: 'The emergency accountability event for your area is no longer active.',
      href: '/family',
      pushEligible: true,
    });
  }
  return { ok: true, state: next, message: 'Emergency event closed in the prototype.', entityId: event.id };
}

export function submitFamily(
  state: PrototypeState,
  actor: Sailor,
  eventId: string,
  members: FamilyMemberReport[],
  deps: DomainDeps,
): Mutation {
  const event = state.emergencies.find((item) => item.id === eventId);
  if (!event?.active) return fail('There is no active family accountability event.');
  const dependents = state.dependents.filter((item) => item.sponsorId === actor.id);
  if (dependents.length === 0) return fail('No dependents are registered for you in this prototype.');
  const validation = validateFamily(dependents.map((item) => item.id), members);
  if (validation) return fail(validation);
  const key = `family:${actor.id}:${eventId}:${JSON.stringify(normalizeMembers(members))}`;
  const existing = state.familyRecords.find((item) => item.sponsorId === actor.id && item.emergencyEventId === eventId);
  if (existing && existing.idempotencyKey === key) {
    return { ok: true, state, message: 'This family report was already recorded.', entityId: existing.id };
  }
  const at = stamp(deps);
  const syncState: SyncState = deps.online ? 'RECEIVED_BY_SERVICE' : 'QUEUED_FOR_SUBMISSION';
  const record: FamilyAccountabilityRecord = {
    id: existing?.id ?? deps.id('family'),
    emergencyEventId: eventId,
    sponsorId: actor.id,
    submittedAt: at,
    syncState,
    acknowledgment: 'NFAAS_NOT_CONNECTED',
    members,
    createdAt: existing?.createdAt ?? at,
    updatedAt: at,
    sourceSystem: 'NFAAS_SIMULATION',
    idempotencyKey: key,
    events: [
      ...(existing?.events ?? []),
      {
        id: deps.id('family-event'),
        at,
        actorId: actor.id,
        summary: existing ? 'Family accountability updated' : 'Family accountability submitted',
        members,
        syncState,
      },
    ],
  };
  const superseded = state.needsAssessments.map((item) =>
    item.recordId === record.id && item.supersededAt === null ? { ...item, supersededAt: at, updatedAt: at } : item,
  );
  const assessments = members
    .filter((member) => member.status === 'NEEDS_ASSISTANCE')
    .map((member) => ({
      id: deps.id('need'),
      recordId: record.id,
      dependentId: member.dependentId,
      eventId,
      sponsorId: actor.id,
      needs: member.needs,
      context: member.context,
      createdAt: at,
      updatedAt: at,
      supersededAt: null,
      sourceSystem: 'NFAAS_SIMULATION' as SourceSystem,
      syncState,
    }));
  let next: PrototypeState = {
    ...state,
    familyRecords: existing
      ? state.familyRecords.map((item) => (item.id === existing.id ? record : item))
      : [record, ...state.familyRecords],
    needsAssessments: [...assessments, ...superseded],
  };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: existing ? 'FAMILY_UPDATED' : 'FAMILY_SUBMITTED',
    entityType: 'FamilyAccountabilityRecord',
    entityId: record.id,
    previousState: existing ? existing.syncState : null,
    newState: `${syncState}:NFAAS_NOT_CONNECTED`,
    metadata: { eventId, assistance: String(assessments.length) },
  });
  if (!deps.online) {
    next = queue(next, deps, {
      idempotencyKey: key,
      kind: 'FAMILY',
      entityId: record.id,
      sailorId: actor.id,
      baselineUpdatedAt: at,
    });
  }
  return {
    ok: true,
    state: next,
    message: deps.online
      ? 'Family status submitted.'
      : 'Saved on this device. Not transmitted to NFAAS or your command.',
    entityId: record.id,
  };
}

function validateFamily(dependentIds: string[], members: FamilyMemberReport[]): string | null {
  if (members.length !== dependentIds.length) return 'Report every registered family member before submitting.';
  const seen = new Set<string>();
  for (const member of members) {
    if (!dependentIds.includes(member.dependentId)) return 'A reported person is not in your registered family.';
    if (seen.has(member.dependentId)) return 'Each family member can be reported once.';
    seen.add(member.dependentId);
    if (!member.status) return 'Choose a status for each family member.';
    if ((member.status === 'DISPLACED' || member.status === 'NEEDS_ASSISTANCE') && !member.generalLocation?.trim()) {
      return 'Enter a general area, such as a city or neighborhood. Do not enter a street address.';
    }
    if (member.status === 'NEEDS_ASSISTANCE' && member.needs.length === 0) {
      return 'Select the kind of help needed. Do not include a diagnosis.';
    }
    if (member.context.trim().length > 280) return 'Keep the assistance note under 280 characters.';
    if (member.status !== 'NEEDS_ASSISTANCE' && member.needs.length > 0) {
      return 'Assistance needs apply only when a family member needs assistance.';
    }
  }
  if (seen.size !== dependentIds.length) return 'Report every registered family member before submitting.';
  return null;
}

function normalizeMembers(members: FamilyMemberReport[]) {
  return [...members]
    .map((member) => ({
      ...member,
      generalLocation: member.generalLocation?.trim() || null,
      safeContact: member.safeContact?.trim() || null,
      context: member.context.trim(),
      needs: [...member.needs].sort(),
    }))
    .sort((a, b) => a.dependentId.localeCompare(b.dependentId));
}

export function requestFamilyReview(state: PrototypeState, actor: Sailor, note: string, deps: DomainDeps): Mutation {
  const text = note.trim();
  if (text.length < 8) return fail('Describe what should be reviewed. This stays on the device.');
  const at = stamp(deps);
  const request = {
    id: deps.id('review'),
    sponsorId: actor.id,
    note: text,
    createdAt: at,
    status: 'SAVED_ON_DEVICE' as const,
    transmitted: false as const,
  };
  let next: PrototypeState = { ...state, reviewRequests: [request, ...state.reviewRequests] };
  next = pushAudit(next, deps, {
    actorId: actor.id,
    onBehalfOfId: actor.id,
    action: 'FAMILY_REVIEW_REQUESTED',
    entityType: 'InfoReviewRequest',
    entityId: request.id,
    previousState: null,
    newState: 'SAVED_ON_DEVICE',
    metadata: { transmitted: 'false' },
  });
  return {
    ok: true,
    state: next,
    message: 'Review request saved on this device. It was not sent to DEERS, NFAAS, or your command.',
    entityId: request.id,
  };
}

export interface EmergencyAggregate {
  eventId: string | null;
  eventName: string | null;
  active: boolean;
  applicableSponsors: number;
  accounted: number;
  pending: number;
  assistanceRequired: number;
  notYetContacted: number;
}

export function emergencyAggregate(state: PrototypeState, actor: Sailor): Result<EmergencyAggregate> {
  if (rosterScope(actor) === 'NONE') {
    return { ok: false, error: 'You are not authorized to view command accountability.' };
  }
  const event = activeEmergency(state);
  const sponsors = state.sailors.filter(
    (sailor) => sailor.commandId === state.command.id && state.dependents.some((item) => item.sponsorId === sailor.id),
  );
  const empty: EmergencyAggregate = {
    eventId: event?.id ?? null,
    eventName: event?.name ?? null,
    active: Boolean(event),
    applicableSponsors: sponsors.length,
    accounted: 0,
    pending: event ? sponsors.length : 0,
    assistanceRequired: 0,
    notYetContacted: 0,
  };
  if (!event) return { ok: true, value: empty };
  let accounted = 0;
  let assistanceRequired = 0;
  let notYetContacted = 0;
  for (const sponsor of sponsors) {
    const record = state.familyRecords.find(
      (item) => item.sponsorId === sponsor.id && item.emergencyEventId === event.id && item.syncState === 'RECEIVED_BY_SERVICE',
    );
    if (!record) continue;
    accounted += 1;
    if (record.members.some((member) => member.status === 'NEEDS_ASSISTANCE')) assistanceRequired += 1;
    notYetContacted += record.members.filter((member) => member.status === 'UNABLE_TO_CONTACT').length;
  }
  return {
    ok: true,
    value: {
      ...empty,
      accounted,
      pending: sponsors.length - accounted,
      assistanceRequired,
      notYetContacted,
    },
  };
}

export function approvedAbsencesOn(state: PrototypeState, sailorId: string, isoDate: string): SnivRequest[] {
  return state.snivRequests.filter(
    (request) =>
      request.sailorId === sailorId &&
      request.status === 'APPROVED' &&
      request.date <= isoDate &&
      request.endDate >= isoDate,
  );
}

export function snivExcusesMuster(): boolean {
  return false;
}

export function absenceInformsMuster(request: SnivRequest, isoDate: string): boolean {
  return request.status === 'APPROVED' && request.date <= isoDate && request.endDate >= isoDate;
}

export function snivConflicts(state: PrototypeState, request: SnivRequest): boolean {
  const start = Date.parse(`${request.date}T${request.startTime}:00Z`);
  const end = Date.parse(`${request.endDate}T${request.endTime}:00Z`);
  return state.snivRequests.some((other) => {
    if (other.id === request.id || other.sailorId !== request.sailorId || other.status !== 'APPROVED') return false;
    const otherStart = Date.parse(`${other.date}T${other.startTime}:00Z`);
    const otherEnd = Date.parse(`${other.endDate}T${other.endTime}:00Z`);
    return start < otherEnd && otherStart < end;
  });
}

export function refreshDerived(state: PrototypeState, deps: DomainDeps): PrototypeState {
  const timeZone = state.command.timezone;
  const due = state.snivRequests.filter((request) => {
    if (request.status !== 'APPROVED') return false;
    return deps.now().getTime() > Date.parse(zonedLocalToUtc(request.endDate, request.endTime, timeZone));
  });
  if (due.length === 0) return state;
  let next = state;
  for (const request of due) {
    const updated: SnivRequest = { ...request, status: 'COMPLETED', updatedAt: stamp(deps) };
    next = {
      ...next,
      snivRequests: next.snivRequests.map((item) => (item.id === request.id ? updated : item)),
    };
    next = pushAudit(next, deps, {
      actorId: 'prototype-clock',
      onBehalfOfId: request.sailorId,
      action: 'SNIV_COMPLETED',
      entityType: 'SnivRequest',
      entityId: request.id,
      previousState: snivBusiness(request),
      newState: snivBusiness(updated),
      metadata: {},
    });
  }
  return next;
}

export function prepare(state: PrototypeState, deps: DomainDeps): PrototypeState {
  const withCalendar = ensureCalendar(state, deps.now());
  return refreshDerived(withCalendar, deps);
}

export function synchronize(state: PrototypeState, actor: Sailor | null, deps: DomainDeps): Mutation {
  const queued = state.outbox.filter((item) => item.status === 'QUEUED');
  if (!deps.online) return fail('Still offline. Queued items remain on this device.');
  if (queued.length === 0) return { ok: true, state, message: 'Nothing is waiting to sync.' };
  let next = state;
  for (const item of queued) {
    next = applySync(next, item, actor, deps);
  }
  const conflicts = next.outbox.filter((item) => queued.some((queuedItem) => queuedItem.id === item.id) && item.status === 'CONFLICT');
  return {
    ok: true,
    state: next,
    message: conflicts.length
      ? 'Some queued items conflict with a command record and were not applied.'
      : 'Queued submissions were received by the prototype service. They were not marked verified.',
  };
}

function applySync(state: PrototypeState, item: OutboxItem, actor: Sailor | null, deps: DomainDeps): PrototypeState {
  if (item.kind === 'MUSTER') return syncMuster(state, item, actor, deps);
  if (item.kind === 'SNIV') return syncSniv(state, item, actor, deps);
  return syncFamily(state, item, actor, deps);
}

function markOutbox(state: PrototypeState, id: string, status: OutboxItem['status'], conflictNote: string | null): PrototypeState {
  return {
    ...state,
    outbox: state.outbox.map((item) => (item.id === id ? { ...item, status, conflictNote } : item)),
  };
}

function syncMuster(state: PrototypeState, item: OutboxItem, actor: Sailor | null, deps: DomainDeps): PrototypeState {
  const record = state.musters.find((entry) => entry.id === item.entityId);
  if (!record) return markOutbox(state, item.id, 'CONFLICT', 'The queued muster no longer exists.');
  if (record.syncState === 'RECEIVED_BY_SERVICE' || record.syncState === 'VERIFIED_BY_COMMAND') {
    if (record.idempotencyKey === item.idempotencyKey) return markOutbox(state, item.id, 'SYNCED', null);
    return markOutbox(state, item.id, 'CONFLICT', 'A command record already exists for this muster period.');
  }
  if (record.verification === 'VERIFIED' && record.idempotencyKey !== item.idempotencyKey) {
    return markOutbox(state, item.id, 'CONFLICT', 'Command verification is already on file. The queued update was not applied.');
  }
  const at = stamp(deps);
  const updated: MusterRecord = {
    ...record,
    syncState: 'RECEIVED_BY_SERVICE',
    verification: 'AWAITING_VERIFICATION',
    updatedAt: at,
  };
  let next = replaceMuster(markOutbox(state, item.id, 'SYNCED', null), updated);
  next = pushAudit(next, deps, {
    actorId: actor?.id ?? 'prototype-sync',
    onBehalfOfId: record.sailorId,
    action: 'MUSTER_RECEIVED',
    entityType: 'MusterRecord',
    entityId: record.id,
    previousState: businessMusterState(record),
    newState: businessMusterState(updated),
    metadata: { idempotencyKey: item.idempotencyKey },
  });
  return next;
}

function syncSniv(state: PrototypeState, item: OutboxItem, actor: Sailor | null, deps: DomainDeps): PrototypeState {
  const request = state.snivRequests.find((entry) => entry.id === item.entityId);
  if (!request || request.status === 'CANCELLED') return markOutbox(state, item.id, 'SYNCED', null);
  if (request.syncState === 'RECEIVED_BY_SERVICE' || request.syncState === 'VERIFIED_BY_COMMAND') {
    return markOutbox(state, item.id, 'SYNCED', null);
  }
  const at = stamp(deps);
  const updated: SnivRequest = { ...request, syncState: 'RECEIVED_BY_SERVICE', updatedAt: at };
  let next: PrototypeState = {
    ...markOutbox(state, item.id, 'SYNCED', null),
    snivRequests: state.snivRequests.map((entry) => (entry.id === request.id ? updated : entry)),
  };
  next = pushAudit(next, deps, {
    actorId: actor?.id ?? 'prototype-sync',
    onBehalfOfId: request.sailorId,
    action: 'SNIV_RECEIVED',
    entityType: 'SnivRequest',
    entityId: request.id,
    previousState: snivBusiness(request),
    newState: snivBusiness(updated),
    metadata: { idempotencyKey: item.idempotencyKey },
  });
  next = pushNotification(next, deps, {
    recipientId: request.supervisorId,
    kind: 'SNIV_SUBMITTED',
    title: 'Time-away request to review',
    body: 'A time-away request is waiting for your review.',
    href: '/team/approvals',
    pushEligible: true,
  });
  return next;
}

function syncFamily(state: PrototypeState, item: OutboxItem, actor: Sailor | null, deps: DomainDeps): PrototypeState {
  const record = state.familyRecords.find((entry) => entry.id === item.entityId);
  if (!record) return markOutbox(state, item.id, 'CONFLICT', 'The queued family report no longer exists.');
  if (record.syncState === 'RECEIVED_BY_SERVICE') {
    if (record.idempotencyKey === item.idempotencyKey) return markOutbox(state, item.id, 'SYNCED', null);
    return markOutbox(state, item.id, 'CONFLICT', 'A received family report already exists. The queued copy was not applied.');
  }
  const at = stamp(deps);
  const updated: FamilyAccountabilityRecord = {
    ...record,
    syncState: 'RECEIVED_BY_SERVICE',
    acknowledgment: 'NFAAS_NOT_CONNECTED',
    updatedAt: at,
  };
  let next: PrototypeState = {
    ...markOutbox(state, item.id, 'SYNCED', null),
    familyRecords: state.familyRecords.map((entry) => (entry.id === record.id ? updated : entry)),
    needsAssessments: state.needsAssessments.map((entry) =>
      entry.recordId === record.id && entry.supersededAt === null ? { ...entry, syncState: 'RECEIVED_BY_SERVICE', updatedAt: at } : entry,
    ),
  };
  next = pushAudit(next, deps, {
    actorId: actor?.id ?? 'prototype-sync',
    onBehalfOfId: record.sponsorId,
    action: 'FAMILY_RECEIVED',
    entityType: 'FamilyAccountabilityRecord',
    entityId: record.id,
    previousState: record.syncState,
    newState: 'RECEIVED_BY_SERVICE:NFAAS_NOT_CONNECTED',
    metadata: { idempotencyKey: item.idempotencyKey },
  });
  return next;
}

export function categoryLabel(category: SnivRequest['category']): string {
  return SNIV_CATEGORY_LABEL[category];
}

export function needsCatalog(): NeedType[] {
  return ['MEDICAL', 'LODGING', 'TRANSPORTATION', 'FOOD_WATER', 'FINANCIAL', 'FAMILY_CONTACT', 'OTHER'];
}
