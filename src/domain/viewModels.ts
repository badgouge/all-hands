import {
  absenceInformsMuster,
  activeEmergency,
  approvedAbsencesOn,
  canVerifyMuster,
  currentMuster,
  directReports,
  emergencyAggregate,
  periodForDate,
  periodPhase,
  rosterScope,
  snivConflicts,
  type PeriodPhase,
} from './accountability';
import {
  displayName,
  FAMILY_STATUS_LABEL,
  MUSTER_STATUS_LABEL,
  MUSTER_STATUS_SHORT,
  RELATIONSHIP_LABEL,
  SNIV_CATEGORY_LABEL,
  SNIV_STATUS_LABEL,
  SYNC_LABEL,
} from './labels';
import { formatDateShort, formatMilitary, formatTimestamp, todayInZone } from './time';
import type { MusterRecord, PrototypeState, Sailor, SnivRequest } from './types';

export interface MusterCardModel {
  state:
    | 'NOT_MUSTERED'
    | 'MUSTERED'
    | 'EXCUSED'
    | 'AWAITING_VERIFICATION'
    | 'WINDOW_CLOSED'
    | 'ACTION_REQUIRED'
    | 'SAVED_ON_DEVICE'
    | 'NOT_REQUIRED';
  label: string;
  detail: string;
  lastReported: string | null;
  deadline: string | null;
  canSubmit: boolean;
  actionLabel: string;
  approvedAbsenceNote: string | null;
  phase: PeriodPhase;
  recordId: string | null;
}

export function musterCardModel(state: PrototypeState, sailor: Sailor, now: Date, forceDutyDay: boolean): MusterCardModel {
  const timeZone = state.command.timezone;
  const today = todayInZone(timeZone, now);
  const period = periodForDate(state, today);
  const phase = period ? periodPhase(period, now, timeZone, forceDutyDay) : 'CLOSED';
  const record = currentMuster(state, sailor.id, today);
  const note = approvedAbsenceNote(state, sailor.id, today);
  const deadline = period && phase !== 'NOT_REQUIRED' ? `Deadline ${formatMilitary(period.windowEnd)}` : null;
  const lastReported = record?.submittedAt
    ? formatTimestamp(record.submittedAt, timeZone)
    : previousMusterLabel(state, sailor.id, today, timeZone);
  const base = {
    lastReported,
    deadline,
    approvedAbsenceNote: note,
    phase,
    recordId: record?.id ?? null,
    canSubmit: false,
    actionLabel: 'Muster Now',
  };

  if (!period || phase === 'NOT_REQUIRED') {
    const reason = period?.reasonIfNotRequired === 'HOLIDAY' ? 'Today is a command holiday.' : 'Today is not a required muster day.';
    return { ...base, state: 'NOT_REQUIRED', label: 'No muster required', detail: reason };
  }
  if (!record && (phase === 'PRIMARY' || phase === 'LATE')) {
    return {
      ...base,
      state: 'NOT_MUSTERED',
      label: 'Not Mustered',
      detail: phase === 'LATE' ? 'The primary deadline has passed. Late reporting is still open.' : 'You have not checked in today.',
      canSubmit: true,
    };
  }
  if (!record) {
    return { ...base, state: 'WINDOW_CLOSED', label: 'Muster Window Closed', detail: 'Today’s reporting window has ended.' };
  }
  if (record.syncState === 'QUEUED_FOR_SUBMISSION' || record.syncState === 'SAVED_ON_DEVICE') {
    return {
      ...base,
      state: 'SAVED_ON_DEVICE',
      label: 'Saved on Device',
      detail: `Queued for submission at ${formatTimestamp(record.submittedAt ?? record.updatedAt, timeZone)}. Your command has not received this muster.`,
      canSubmit: true,
      actionLabel: 'Update status',
    };
  }
  if (record.verification === 'DISCREPANCY') {
    return {
      ...base,
      state: 'ACTION_REQUIRED',
      label: 'Action Required',
      detail: 'Your command flagged this muster. Review the note in your history.',
    };
  }
  if (record.verification === 'AWAITING_VERIFICATION' || record.verification === 'NOT_SUBMITTED') {
    const submitted = formatTimestamp(record.submittedAt ?? record.updatedAt, timeZone);
    const late = record.events.some((event) => event.note?.includes('deadline'));
    return {
      ...base,
      state: 'AWAITING_VERIFICATION',
      label: 'Awaiting Verification',
      detail: late
        ? `Submitted at ${submitted}. You reported after the ${formatMilitary(period.windowEnd)} deadline. Awaiting command verification.`
        : `Submitted at ${submitted}. Awaiting command verification.`,
      canSubmit: state.command.musterPolicy.allowSailorCorrection,
      actionLabel: 'Update status',
    };
  }
  const excused = record.status === 'APPROVED_LEAVE' || record.status === 'TAD' || record.status === 'AUTHORIZED_ABSENCE';
  const source = record.statusOrigin === 'SYSTEM_DERIVED' ? ' Reported by a duty or leave system.' : '';
  return {
    ...base,
    state: excused ? 'EXCUSED' : 'MUSTERED',
    label: excused ? 'Excused' : 'Muster Confirmed',
    detail: `${MUSTER_STATUS_LABEL[record.status]}.${source} ${SYNC_LABEL[record.syncState]}.`,
  };
}

function approvedAbsenceNote(state: PrototypeState, sailorId: string, today: string): string | null {
  const match = approvedAbsencesOn(state, sailorId, today)[0];
  if (!match || !absenceInformsMuster(match, today)) return null;
  return `Approved absence — ${SNIV_CATEGORY_LABEL[match.category]}, ${formatMilitary(match.startTime)}–${formatMilitary(match.endTime)}`;
}

function previousMusterLabel(state: PrototypeState, sailorId: string, today: string, timeZone: string): string | null {
  const prior = state.musters
    .filter((record) => record.sailorId === sailorId && record.reportingDate < today && record.submittedAt)
    .sort((a, b) => b.reportingDate.localeCompare(a.reportingDate))[0];
  if (!prior?.submittedAt) return null;
  return `${formatDateShort(prior.reportingDate, timeZone)} ${formatTimestamp(prior.submittedAt, timeZone)}`;
}

export function familyCardModel(state: PrototypeState, sailor: Sailor) {
  const dependents = state.dependents.filter((item) => item.sponsorId === sailor.id);
  const event = activeEmergency(state);
  const record = event
    ? state.familyRecords.find((item) => item.sponsorId === sailor.id && item.emergencyEventId === event.id)
    : undefined;
  let statusLine = 'No active family accountability events.';
  if (dependents.length === 0) statusLine = 'No dependents are registered.';
  else if (event && !record) statusLine = 'Family accountability required.';
  else if (record?.syncState === 'QUEUED_FOR_SUBMISSION') statusLine = 'Saved on device — not transmitted to NFAAS.';
  else if (record) statusLine = 'Not transmitted to NFAAS.';
  return {
    count: dependents.length,
    eventActive: Boolean(event),
    eventName: event?.name ?? null,
    eventSummary: event?.summary ?? null,
    statusLine,
    showAccount: Boolean(event) && dependents.length > 0,
    record,
  };
}

export function snivCardModel(state: PrototypeState, sailor: Sailor, today: string) {
  const mine = state.snivRequests.filter((request) => request.sailorId === sailor.id);
  const next = mine
    .filter(
      (request) =>
        request.status !== 'DENIED' &&
        request.status !== 'CANCELLED' &&
        request.status !== 'COMPLETED' &&
        request.endDate >= today,
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0];
  return {
    next: next
      ? {
          id: next.id,
          label: SNIV_CATEGORY_LABEL[next.category],
          when: `${formatDateShort(next.date, state.command.timezone)} ${formatMilitary(next.startTime)}–${formatMilitary(next.endTime)}`,
        }
      : null,
    pending: mine.filter((request) => request.status === 'PENDING_APPROVAL').length,
    returned: mine.filter((request) => request.status === 'RETURNED').length,
  };
}

export interface RosterRowModel {
  sailorId: string;
  name: string;
  division: string;
  statusLabel: string;
  verificationLabel: string;
  syncLabel: string;
  reportedAt: string | null;
  attention: boolean;
  recordId: string | null;
  canVerify: boolean;
}

export function rosterRows(state: PrototypeState, actor: Sailor, now: Date, forceDutyDay: boolean): RosterRowModel[] {
  const scope = rosterScope(actor);
  const people =
    scope === 'COMMAND'
      ? state.sailors.filter((sailor) => sailor.commandId === state.command.id)
      : scope === 'DIRECT_REPORTS'
        ? [actor, ...directReports(state, actor.id).filter((sailor) => sailor.id !== actor.id)]
        : [];
  const today = todayInZone(state.command.timezone, now);
  const period = periodForDate(state, today);
  const required = period ? periodPhase(period, now, state.command.timezone, forceDutyDay) !== 'NOT_REQUIRED' : false;
  return people.map((sailor) => {
    const record = currentMuster(state, sailor.id, today);
    return rowFromRecord(state, actor, sailor, record, required);
  });
}

export interface WorkCenterMember {
  sailorId: string;
  name: string;
  division: string;
  musterLabel: string;
  track: 'Ready' | 'Confirmed' | 'Not mustered' | 'Held';
  pendingSnivs: number;
}

export function workCenterQueue(state: PrototypeState, actor: Sailor, now: Date, forceDutyDay: boolean): WorkCenterMember[] {
  return rosterRows(state, actor, now, forceDutyDay).map((row) => {
    const pendingSnivs = state.snivRequests.filter(
      (request) =>
        request.sailorId === row.sailorId &&
        request.supervisorId === actor.id &&
        request.status === 'PENDING_APPROVAL' &&
        request.syncState === 'RECEIVED_BY_SERVICE',
    ).length;
    const track =
      row.verificationLabel === 'Verified'
        ? 'Confirmed'
        : row.verificationLabel === 'Awaiting verification'
          ? 'Ready'
          : row.verificationLabel === 'Discrepancy' || row.verificationLabel === 'Not received'
            ? 'Held'
            : 'Not mustered';
    return {
      sailorId: row.sailorId,
      name: row.name,
      division: row.division,
      musterLabel: row.statusLabel,
      track,
      pendingSnivs,
    };
  });
}

function rowFromRecord(
  state: PrototypeState,
  actor: Sailor,
  sailor: Sailor,
  record: MusterRecord | undefined,
  required: boolean,
): RosterRowModel {
  const queued = record?.syncState === 'QUEUED_FOR_SUBMISSION' || record?.syncState === 'SAVED_ON_DEVICE';
  const received = record && !queued;
  const attention = Boolean(
    (required && !received) ||
      record?.verification === 'DISCREPANCY' ||
      (received &&
        record.verification === 'AWAITING_VERIFICATION' &&
        (record.status === 'SICK' || record.status === 'UNABLE_TO_REPORT')),
  );
  return {
    sailorId: sailor.id,
    name: displayName(sailor),
    division: sailor.division,
    statusLabel: record ? MUSTER_STATUS_SHORT[record.status] : 'Not mustered',
    verificationLabel: !record
      ? 'Not mustered'
      : queued
        ? 'Not received'
        : record.verification === 'VERIFIED'
          ? 'Verified'
          : record.verification === 'DISCREPANCY'
            ? 'Discrepancy'
            : 'Awaiting verification',
    syncLabel: record ? SYNC_LABEL[record.syncState] : 'No submission',
    reportedAt: record?.submittedAt ? formatTimestamp(record.submittedAt, state.command.timezone) : null,
    attention,
    recordId: record?.id ?? null,
    canVerify: Boolean(record && canVerifyMuster(state, actor, sailor.id) && !queued),
  };
}

export function activityItems(state: PrototypeState, sailorId: string, timeZone: string) {
  return state.audit
    .filter((event) => event.actorId === sailorId || event.onBehalfOfId === sailorId)
    .slice(0, 6)
    .map((event) => ({
      id: event.id,
      at: `${formatDateShort(event.at.slice(0, 10), timeZone)} ${formatTimestamp(event.at, timeZone)}`,
      text: activityText(event.action),
    }));
}

function activityText(action: string): string {
  const labels: Record<string, string> = {
    MUSTER_SUBMITTED: 'Muster submitted',
    MUSTER_CORRECTED: 'Muster updated',
    MUSTER_VERIFIED: 'Muster verified by command',
    MUSTER_FLAGGED: 'Muster flagged by command',
    MUSTER_SUPERVISOR_CORRECTION: 'Muster corrected by command',
    MUSTER_CERTIFIER_OVERRIDE: 'Muster overridden by the command certifier',
    MUSTER_RECEIVED: 'Muster received',
    SNIV_SUBMITTED: 'Snivel request submitted',
    SNIV_APPROVED: 'Snivel request approved',
    SNIV_DENIED: 'Snivel request denied',
    SNIV_RETURNED: 'Snivel request returned',
    SNIV_CANCELLED: 'Snivel request cancelled',
    SNIV_RESUBMITTED: 'Snivel request sent again',
    SNIV_COMPLETED: 'Approved absence ended',
    SNIV_DRAFT_SAVED: 'Snivel draft saved on device',
    SNIV_RECEIVED: 'Snivel request received',
    FAMILY_SUBMITTED: 'Family accountability submitted',
    FAMILY_UPDATED: 'Family accountability updated',
    FAMILY_RECEIVED: 'Family report received',
    EMERGENCY_ACTIVATED: 'Emergency accountability event activated',
    EMERGENCY_CLOSED: 'Emergency accountability event closed',
    FAMILY_REVIEW_REQUESTED: 'Family information review saved on device',
  };
  return labels[action] ?? 'All Hands activity';
}

export function upcomingAbsences(state: PrototypeState, sailorId: string, today: string) {
  return state.snivRequests
    .filter((request) => request.sailorId === sailorId && request.status === 'APPROVED' && request.endDate >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((request) => ({
      id: request.id,
      title: SNIV_CATEGORY_LABEL[request.category],
      when: `${formatDateShort(request.date, state.command.timezone)} ${formatMilitary(request.startTime)}–${formatMilitary(request.endTime)}`,
    }));
}

export function supervisorQueue(state: PrototypeState, actor: Sailor) {
  return state.snivRequests.filter(
    (request) =>
      request.supervisorId === actor.id &&
      request.sailorId !== actor.id &&
      request.status === 'PENDING_APPROVAL' &&
      request.syncState === 'RECEIVED_BY_SERVICE',
  );
}

export function queueItem(state: PrototypeState, request: SnivRequest) {
  const sailor = state.sailors.find((item) => item.id === request.sailorId);
  return {
    id: request.id,
    requester: sailor ? displayName(sailor) : 'Sailor',
    when: `${formatDateShort(request.date, state.command.timezone)} ${formatMilitary(request.startTime)}–${formatMilitary(request.endTime)}`,
    duration: request.durationMinutes,
    category: SNIV_CATEGORY_LABEL[request.category],
    remarks: request.remarks,
    conflict: snivConflicts(state, request),
    status: SNIV_STATUS_LABEL[request.status],
  };
}

export function commandSnapshot(state: PrototypeState, actor: Sailor, now: Date, forceDutyDay: boolean) {
  const rows = rosterRows(state, actor, now, forceDutyDay);
  const aggregate = emergencyAggregate(state, actor);
  return {
    rows,
    verified: rows.filter((row) => row.verificationLabel === 'Verified').length,
    awaiting: rows.filter((row) => row.verificationLabel === 'Awaiting verification').length,
    missing: rows.filter((row) => row.verificationLabel === 'Not mustered' || row.verificationLabel === 'Not received').length,
    queue: supervisorQueue(state, actor).length,
    aggregate: aggregate.ok ? aggregate.value : null,
    aggregateError: aggregate.ok ? null : aggregate.error,
  };
}

export function familyHistory(state: PrototypeState, sailorId: string) {
  return state.familyRecords
    .filter((record) => record.sponsorId === sailorId)
    .map((record) => {
      const event = state.emergencies.find((item) => item.id === record.emergencyEventId);
      return {
        id: record.id,
        eventName: event?.name ?? 'Emergency event',
        active: Boolean(event?.active),
        syncLabel: SYNC_LABEL[record.syncState],
        acknowledgment: 'Not transmitted to NFAAS.',
        members: record.members.map((member) => {
          const person = state.dependents.find((item) => item.id === member.dependentId);
          return {
            name: person ? `${person.firstName} ${person.lastName}` : 'Family member',
            relationship: person ? RELATIONSHIP_LABEL[person.relationship] : '',
            status: FAMILY_STATUS_LABEL[member.status],
          };
        }),
      };
    });
}

export function auditTrail(state: PrototypeState, entityType: string, entityId: string, timeZone: string) {
  return state.audit
    .filter((event) => event.entityType === entityType && event.entityId === entityId)
    .map((event) => ({
      id: event.id,
      at: `${formatTimestamp(event.at, timeZone)} ${formatDateShort(event.at.slice(0, 10), timeZone)}`,
      action: activityText(event.action),
      actorId: event.actorId,
      previousState: event.previousState,
      newState: event.newState,
    }));
}
