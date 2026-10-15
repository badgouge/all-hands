import { makePeriod } from '../domain/accountability';
import { addDays, dateRange, todayInZone, zonedLocalToUtc } from '../domain/time';
import type {
  AuditEvent,
  Command,
  CommandAssignment,
  Dependent,
  MusterRecord,
  MusterStatus,
  PrototypeState,
  Sailor,
  SnivRequest,
  SupervisorRelationship,
} from '../domain/types';

const TZ = 'America/Chicago';

export const SAILOR_ID = 'sailor-alex';
export const SUPERVISOR_ID = 'sailor-jordan';
export const CERTIFIER_ID = 'sailor-xo';

const command: Command = {
  id: 'command-meridian',
  name: 'Naval Support Activity Meridian Point',
  shortName: 'NSA Meridian Point',
  uic: 'N4X901',
  timezone: TZ,
  snivCategories: ['MEDICAL', 'DENTAL', 'DEPENDENT', 'PERSONAL', 'ADMINISTRATIVE', 'OTHER'],
  musterPolicy: {
    primaryWindowStart: '00:00',
    primaryWindowEnd: '09:00',
    lateWindowEnd: '23:59',
    dutyDays: [1, 2, 3, 4, 5],
    holidays: ['2026-10-12'],
    snivSatisfiesMuster: false,
    allowSailorCorrection: true,
  },
};

const sailors: Sailor[] = [
  person(SAILOR_ID, 'Alex', 'Rivera', 'J', 'HM2', 'Medical', 'MNP-48101', ['SAILOR']),
  person(SUPERVISOR_ID, 'Jordan', 'Hale', 'A', 'IT1', 'Medical', 'MNP-48114', ['SAILOR', 'SUPERVISOR']),
  person(CERTIFIER_ID, 'Ellen', 'Cho', null, 'CDR', 'Command', 'MNP-48001', ['SAILOR', 'COMMAND_CERTIFIER']),
  person('sailor-samir', 'Samir', 'Patel', null, 'HM3', 'Medical', 'MNP-48130', ['SAILOR']),
  person('sailor-rowan', 'Rowan', 'Chen', null, 'HN', 'Medical', 'MNP-48141', ['SAILOR']),
  person('sailor-quinn', 'Quinn', 'Alvarez', null, 'HM3', 'Medical', 'MNP-48163', ['SAILOR']),
  person('sailor-drew', 'Drew', 'Okonkwo', null, 'HN', 'Medical', 'MNP-48170', ['SAILOR']),
  person('sailor-parker', 'Parker', 'Singh', null, 'HM2', 'Medical', 'MNP-48188', ['SAILOR']),
];

function person(
  id: string,
  firstName: string,
  lastName: string,
  middleInitial: string | null,
  rank: string,
  division: string,
  prototypeId: string,
  roles: Sailor['roles'],
): Sailor {
  return { id, firstName, lastName, middleInitial, rank, division, prototypeId, roles, commandId: command.id };
}

const relationships: SupervisorRelationship[] = [
  SAILOR_ID,
  'sailor-samir',
  'sailor-rowan',
  'sailor-quinn',
  'sailor-drew',
  'sailor-parker',
].map((sailorId) => ({
  id: `rel-${SUPERVISOR_ID}-${sailorId}`,
  supervisorId: SUPERVISOR_ID,
  sailorId,
  commandId: command.id,
  active: true,
}));

const assignments: CommandAssignment[] = sailors.map((sailor) => ({
  id: `assign-${sailor.id}`,
  sailorId: sailor.id,
  commandId: command.id,
  uic: command.uic,
  startDate: '2024-06-01',
  endDate: null,
  dutyStatus: 'ON_DUTY',
}));

const HOME = '418 Harbor Lane, Meridian Point, MS 39301';

const dependents: Dependent[] = [
  dependent('dep-morgan', 'Morgan', 'Rivera', 'SPOUSE', '(228) 555-0142', HOME, 'CURRENT', '2026-09-02', 'SAFE'),
  dependent('dep-riley', 'Riley', 'Rivera', 'CHILD', '(228) 555-2281', HOME, 'REVIEW_DUE', '2026-06-18', 'UNKNOWN'),
  dependent('dep-avery', 'Avery', 'Rivera', 'CHILD', '(228) 555-7730', HOME, 'CURRENT', '2026-09-02', 'SAFE'),
  dependent('dep-elena', 'Elena', 'Vargas', 'PARENT', '(228) 555-4419', '92 Cedar Street, Meridian Point, MS 39305', 'REVIEW_DUE', '2026-04-11', 'UNKNOWN'),
];

function dependent(
  id: string,
  firstName: string,
  lastName: string,
  relationship: Dependent['relationship'],
  phone: string,
  address: string,
  preparednessStatus: Dependent['preparednessStatus'],
  verifiedDate: string,
  currentStatus: NonNullable<Dependent['currentStatus']>,
): Dependent {
  return {
    id,
    sponsorId: SAILOR_ID,
    firstName,
    lastName,
    relationship,
    phone,
    address,
    contactSummary: `${phone} · ${address}`,
    currentStatus,
    statusLocation: null,
    preparednessStatus,
    lastVerifiedAt: zonedLocalToUtc(verifiedDate, '09:00', TZ),
    sourceSystem: 'PERSONNEL_SERVICE',
  };
}

export function createSeed(now: Date): PrototypeState {
  const today = todayInZone(TZ, now);
  const periods = dateRange(addDays(today, -14), today).map((date) => makePeriod(command, date));
  const musters: MusterRecord[] = [];
  for (const period of periods) {
    if (!period.required || period.reportingDate === today) continue;
    for (const sailor of sailors) {
      musters.push(buildRecord(sailor, period.reportingDate, 'PRESENT', 'VERIFIED', SUPERVISOR_ID, '06:40'));
    }
  }
  musters.push(
    buildRecord(sailors[1], today, 'PRESENT', 'VERIFIED', SUPERVISOR_ID, '06:20'),
    buildRecord(byId(CERTIFIER_ID), today, 'PRESENT', 'VERIFIED', CERTIFIER_ID, '06:05'),
    buildRecord(byId('sailor-samir'), today, 'PRESENT', 'AWAITING_VERIFICATION', null, '07:12'),
    buildRecord(byId('sailor-rowan'), today, 'PRESENT', 'AWAITING_VERIFICATION', null, '07:22'),
    buildRecord(byId('sailor-drew'), today, 'PRESENT', 'VERIFIED', SUPERVISOR_ID, '06:48'),
    buildRecord(byId('sailor-parker'), today, 'SICK', 'AWAITING_VERIFICATION', null, '07:40'),
  );

  const snivRequests = buildSniv(today, now);
  const lastDuty = [...periods].reverse().find((period) => period.required && period.reportingDate < today);
  const audit: AuditEvent[] = [];
  if (lastDuty) {
    audit.push(auditEvent('audit-alex-last', zonedLocalToUtc(lastDuty.reportingDate, '06:52', TZ), {
      actorId: SUPERVISOR_ID,
      onBehalfOfId: SAILOR_ID,
      action: 'MUSTER_VERIFIED',
      entityType: 'MusterRecord',
      entityId: `muster-${SAILOR_ID}-${lastDuty.reportingDate}`,
      previousState: 'PRESENT:AWAITING_VERIFICATION:RECEIVED_BY_SERVICE',
      newState: 'PRESENT:VERIFIED:VERIFIED_BY_COMMAND',
    }));
  }
  audit.push(auditEvent('audit-sniv-approved', zonedLocalToUtc(addDays(today, -2), '14:10', TZ), {
    actorId: SUPERVISOR_ID,
    onBehalfOfId: SAILOR_ID,
    action: 'SNIV_APPROVED',
    entityType: 'SnivRequest',
    entityId: 'sniv-alex-approved',
    previousState: 'PENDING_APPROVAL:RECEIVED_BY_SERVICE',
    newState: 'APPROVED:VERIFIED_BY_COMMAND',
  }));

  return {
    version: 1,
    sailors,
    command,
    assignments,
    relationships,
    dependents,
    periods,
    musters,
    emergencies: [],
    familyRecords: [],
    needsAssessments: [],
    snivRequests,
    notifications: [
      {
        id: 'notice-sniv-upcoming',
        recipientId: SAILOR_ID,
        kind: 'SNIV_UPCOMING',
        title: 'Approved absence coming up',
        body: 'You have an approved absence coming up. Open Snivel Log for the time.',
        createdAt: zonedLocalToUtc(addDays(today, -1), '16:00', TZ),
        readAt: null,
        href: '/requests',
        pushEligible: true,
        pushDelivery: 'NOT_SENT_NO_PROVIDER',
      },
      {
        id: 'notice-jordan-queue',
        recipientId: SUPERVISOR_ID,
        kind: 'SNIV_SUBMITTED',
        title: 'Snivel request to review',
        body: 'A snivel request is waiting for your review.',
        createdAt: zonedLocalToUtc(addDays(today, -1), '11:20', TZ),
        readAt: null,
        href: '/team',
        pushEligible: true,
        pushDelivery: 'NOT_SENT_NO_PROVIDER',
      },
    ],
    audit,
    outbox: [],
    reviewRequests: [],
    preparednessChecks: { [SAILOR_ID]: ['contacts', 'meeting'] },
    selfHelpRequests: [],
    familyHelpRequests: [],
    lateReports: [],
    households: [
      {
        sponsorId: SAILOR_ID,
        phone: '(228) 555-0108',
        address: HOME,
        shareLocation: 'OWN',
      },
    ],
    commandCertifications: [],
  };
}

function byId(id: string): Sailor {
  const sailor = sailors.find((item) => item.id === id);
  if (!sailor) throw new Error(id);
  return sailor;
}

function buildRecord(
  sailor: Sailor,
  date: string,
  status: MusterStatus,
  verification: 'VERIFIED' | 'AWAITING_VERIFICATION',
  actorId: string | null,
  time: string,
): MusterRecord {
  const periodId = `period-${command.id}-${date}`;
  const submittedAt = zonedLocalToUtc(date, time, TZ);
  const verifiedAt = verification === 'VERIFIED' ? zonedLocalToUtc(date, bump(time), TZ) : null;
  const key = `muster:${sailor.id}:${periodId}:${status}`;
  const submitted = {
    id: `me-${sailor.id}-${date}-s`,
    at: submittedAt,
    actorId: sailor.id,
    type: 'SUBMITTED' as const,
    status,
    verification: 'AWAITING_VERIFICATION' as const,
    note: null,
    source: 'SAILOR_ATTESTATION' as const,
    idempotencyKey: key,
  };
  return {
    id: `muster-${sailor.id}-${date}`,
    sailorId: sailor.id,
    commandId: command.id,
    uic: command.uic,
    periodId,
    reportingDate: date,
    status,
    statusOrigin: 'SAILOR_REPORTED',
    sourceSystem: 'SAILOR_ATTESTATION',
    linkedSnivRequestId: null,
    submittedAt,
    verification,
    verificationActorId: verification === 'VERIFIED' ? actorId : null,
    verifiedAt,
    syncState: verification === 'VERIFIED' ? 'VERIFIED_BY_COMMAND' : 'RECEIVED_BY_SERVICE',
    idempotencyKey: key,
    createdAt: submittedAt,
    updatedAt: verifiedAt ?? submittedAt,
    events: verification === 'VERIFIED'
      ? [
          submitted,
          {
            id: `me-${sailor.id}-${date}-v`,
            at: verifiedAt!,
            actorId: actorId ?? SUPERVISOR_ID,
            type: 'VERIFIED',
            status,
            verification: 'VERIFIED',
            note: null,
            source: 'MUSTER_SERVICE',
            idempotencyKey: key,
          },
        ]
      : [submitted],
  };
}

function bump(time: string): string {
  const [hour, minute] = time.split(':').map(Number);
  const total = Math.min(hour * 60 + minute + 12, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function buildSniv(today: string, now: Date): SnivRequest[] {
  const submitted = zonedLocalToUtc(addDays(today, -2), '13:00', TZ);
  const approvedAt = zonedLocalToUtc(addDays(today, -2), '14:10', TZ);
  return [
    sniv({
      id: 'sniv-alex-approved',
      sailorId: SAILOR_ID,
      supervisorId: SUPERVISOR_ID,
      category: 'DENTAL',
      date: addDays(today, 3),
      startTime: '09:00',
      endTime: '11:00',
      minutes: 120,
      remarks: 'Routine appointment.',
      status: 'APPROVED',
      sync: 'VERIFIED_BY_COMMAND',
      submitted,
      decidedAt: approvedAt,
      decider: SUPERVISOR_ID,
    }),
    sniv({
      id: 'sniv-alex-pending',
      sailorId: SAILOR_ID,
      supervisorId: SUPERVISOR_ID,
      category: 'PERSONAL',
      date: addDays(today, 6),
      startTime: '13:00',
      endTime: '15:00',
      minutes: 120,
      remarks: 'Errand during the duty day.',
      status: 'PENDING_APPROVAL',
      sync: 'RECEIVED_BY_SERVICE',
      submitted: now.toISOString(),
      decidedAt: null,
      decider: null,
    }),
    sniv({
      id: 'sniv-rowan-pending',
      sailorId: 'sailor-rowan',
      supervisorId: SUPERVISOR_ID,
      category: 'MEDICAL',
      date: addDays(today, 4),
      startTime: '10:00',
      endTime: '11:30',
      minutes: 90,
      remarks: 'Follow-up appointment.',
      status: 'PENDING_APPROVAL',
      sync: 'RECEIVED_BY_SERVICE',
      submitted: zonedLocalToUtc(addDays(today, -1), '15:10', TZ),
      decidedAt: null,
      decider: null,
    }),
    sniv({
      id: 'sniv-alex-denied',
      sailorId: SAILOR_ID,
      supervisorId: SUPERVISOR_ID,
      category: 'OTHER',
      date: addDays(today, -20),
      startTime: '10:00',
      endTime: '12:00',
      minutes: 120,
      remarks: 'Personal errand.',
      status: 'DENIED',
      sync: 'VERIFIED_BY_COMMAND',
      submitted: zonedLocalToUtc(addDays(today, -22), '09:00', TZ),
      decidedAt: zonedLocalToUtc(addDays(today, -21), '11:00', TZ),
      decider: SUPERVISOR_ID,
      note: 'The shop cannot release you during that watch.',
    }),
    sniv({
      id: 'sniv-alex-completed',
      sailorId: SAILOR_ID,
      supervisorId: SUPERVISOR_ID,
      category: 'ADMINISTRATIVE',
      date: addDays(today, -8),
      startTime: '08:00',
      endTime: '09:00',
      minutes: 60,
      remarks: 'ID office.',
      status: 'COMPLETED',
      sync: 'VERIFIED_BY_COMMAND',
      submitted: zonedLocalToUtc(addDays(today, -10), '12:00', TZ),
      decidedAt: zonedLocalToUtc(addDays(today, -9), '08:30', TZ),
      decider: SUPERVISOR_ID,
    }),
  ];
}

function sniv(input: {
  id: string;
  sailorId: string;
  supervisorId: string;
  category: SnivRequest['category'];
  date: string;
  startTime: string;
  endTime: string;
  minutes: number;
  remarks: string;
  status: SnivRequest['status'];
  sync: SnivRequest['syncState'];
  submitted: string;
  decidedAt: string | null;
  decider: string | null;
  note?: string;
}): SnivRequest {
  const approvals: SnivRequest['approvals'] = [
    {
      id: `${input.id}-submitted`,
      at: input.submitted,
      actorId: input.sailorId,
      action: 'SUBMITTED',
      note: input.remarks,
      previousStatus: null,
      newStatus: 'PENDING_APPROVAL',
    },
  ];
  if (input.decider && input.decidedAt && input.status !== 'PENDING_APPROVAL') {
    approvals.push({
      id: `${input.id}-decision`,
      at: input.decidedAt,
      actorId: input.decider,
      action: input.status === 'DENIED' ? 'DENIED' : 'APPROVED',
      note: input.note ?? null,
      previousStatus: 'PENDING_APPROVAL',
      newStatus: input.status === 'COMPLETED' ? 'APPROVED' : input.status,
    });
  }
  return {
    id: input.id,
    sailorId: input.sailorId,
    commandId: command.id,
    supervisorId: input.supervisorId,
    category: input.category,
    date: input.date,
    endDate: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    durationMinutes: input.minutes,
    remarks: input.remarks,
    status: input.status,
    createdAt: input.submitted,
    updatedAt: input.decidedAt ?? input.submitted,
    submittedAt: input.submitted,
    sourceSystem: 'SNIV_WORKFLOW',
    syncState: input.sync,
    idempotencyKey: input.id,
    approvals,
  };
}

function auditEvent(id: string, at: string, input: Omit<AuditEvent, 'id' | 'at' | 'sourceApplication' | 'metadata'>): AuditEvent {
  return {
    id,
    at,
    sourceApplication: 'MNP_MOBILE_PROTOTYPE',
    metadata: {},
    actorId: input.actorId,
    onBehalfOfId: input.onBehalfOfId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    previousState: input.previousState,
    newState: input.newState,
  };
}
