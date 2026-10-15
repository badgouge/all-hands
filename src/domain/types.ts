export type Role = 'SAILOR' | 'SUPERVISOR' | 'MUSTER_COORDINATOR' | 'COMMAND_LEADERSHIP' | 'COMMAND_CERTIFIER';

export type SyncState =
  | 'SAVED_ON_DEVICE'
  | 'QUEUED_FOR_SUBMISSION'
  | 'RECEIVED_BY_SERVICE'
  | 'VERIFIED_BY_COMMAND';

export type SourceSystem =
  | 'MNP_MOBILE_PROTOTYPE'
  | 'MUSTER_SERVICE'
  | 'NFAAS_SIMULATION'
  | 'SNIV_WORKFLOW'
  | 'PERSONNEL_SERVICE'
  | 'LEAVE_SYSTEM'
  | 'SAILOR_ATTESTATION';

export type MusterStatus =
  | 'PRESENT'
  | 'TELEWORK'
  | 'TAD'
  | 'APPROVED_LEAVE'
  | 'AUTHORIZED_ABSENCE'
  | 'SICK'
  | 'UNABLE_TO_REPORT';

export type MusterVerification =
  | 'NOT_SUBMITTED'
  | 'AWAITING_VERIFICATION'
  | 'VERIFIED'
  | 'DISCREPANCY';

export type MusterStatusOrigin = 'SAILOR_REPORTED' | 'SYSTEM_DERIVED';

export type FamilyStatus =
  | 'NOT_REPORTED'
  | 'SAFE'
  | 'DISPLACED'
  | 'NEEDS_ASSISTANCE'
  | 'UNABLE_TO_CONTACT'
  | 'UNKNOWN';

export type NeedType =
  | 'MEDICAL'
  | 'LODGING'
  | 'TRANSPORTATION'
  | 'FOOD_WATER'
  | 'FINANCIAL'
  | 'FAMILY_CONTACT'
  | 'OTHER';

export type SnivCategory =
  | 'MEDICAL'
  | 'DENTAL'
  | 'DEPENDENT'
  | 'PERSONAL'
  | 'ADMINISTRATIVE'
  | 'OTHER';

export type SnivStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'DENIED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'COMPLETED';

export type EmergencyKind = 'HURRICANE' | 'WILDFIRE' | 'FLOOD' | 'EARTHQUAKE' | 'EVACUATION' | 'OTHER';

export type NotificationKind =
  | 'MUSTER_WINDOW_OPEN'
  | 'MUSTER_DEADLINE'
  | 'MUSTER_OVERDUE'
  | 'MUSTER_VERIFIED'
  | 'MUSTER_DISCREPANCY'
  | 'EMERGENCY_ACTIVATED'
  | 'FAMILY_REQUESTED'
  | 'FAMILY_INCOMPLETE'
  | 'ASSISTANCE_FOLLOWUP'
  | 'EVENT_UPDATED'
  | 'SNIV_SUBMITTED'
  | 'SNIV_APPROVED'
  | 'SNIV_DENIED'
  | 'SNIV_RETURNED'
  | 'SNIV_UPCOMING'
  | 'SNIV_CANCELLED';

export type DutyStatus = 'ON_DUTY' | 'TAD' | 'LEAVE';

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  onBehalfOfId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousState: string | null;
  newState: string;
  sourceApplication: 'MNP_MOBILE_PROTOTYPE';
  metadata: Record<string, string>;
}

export interface MusterPolicy {
  primaryWindowStart: string;
  primaryWindowEnd: string;
  lateWindowEnd: string;
  dutyDays: number[];
  holidays: string[];
  snivSatisfiesMuster: boolean;
  allowSailorCorrection: boolean;
}

export interface Command {
  id: string;
  name: string;
  shortName: string;
  uic: string;
  timezone: string;
  musterPolicy: MusterPolicy;
  snivCategories: SnivCategory[];
}

export interface Sailor {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial: string | null;
  rank: string;
  division: string;
  prototypeId: string;
  roles: Role[];
  commandId: string;
}

export interface CommandAssignment {
  id: string;
  sailorId: string;
  commandId: string;
  uic: string;
  startDate: string;
  endDate: string | null;
  dutyStatus: DutyStatus;
}

export interface SupervisorRelationship {
  id: string;
  supervisorId: string;
  sailorId: string;
  commandId: string;
  active: boolean;
}

export interface Dependent {
  id: string;
  sponsorId: string;
  firstName: string;
  lastName: string;
  relationship: 'SPOUSE' | 'CHILD' | 'PARENT' | 'OTHER';
  contactSummary: string;
  phone: string;
  address: string;
  currentStatus?: Exclude<FamilyStatus, 'NOT_REPORTED'>;
  statusLocation?: string | null;
  preparednessStatus: 'CURRENT' | 'REVIEW_DUE' | 'INCOMPLETE';
  lastVerifiedAt: string;
  sourceSystem: SourceSystem;
}

export interface MusterPeriod {
  id: string;
  commandId: string;
  reportingDate: string;
  windowStart: string;
  windowEnd: string;
  lateUntil: string;
  required: boolean;
  reasonIfNotRequired: 'WEEKEND' | 'HOLIDAY' | null;
}

export interface MusterEvent {
  id: string;
  at: string;
  actorId: string;
  type: 'SUBMITTED' | 'CORRECTED' | 'VERIFIED' | 'FLAGGED' | 'SUPERVISOR_CORRECTION' | 'CERTIFIER_OVERRIDE';
  status: MusterStatus;
  verification: MusterVerification;
  note: string | null;
  source: SourceSystem;
  idempotencyKey: string;
}

export interface MusterRecord {
  id: string;
  sailorId: string;
  commandId: string;
  uic: string;
  periodId: string;
  reportingDate: string;
  status: MusterStatus;
  statusOrigin: MusterStatusOrigin;
  sourceSystem: SourceSystem;
  linkedSnivRequestId: string | null;
  submittedAt: string | null;
  verification: MusterVerification;
  verificationActorId: string | null;
  verifiedAt: string | null;
  syncState: SyncState;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  events: MusterEvent[];
}

export interface EmergencyEvent {
  id: string;
  name: string;
  kind: EmergencyKind;
  summary: string;
  commandIds: string[];
  active: boolean;
  activatable: boolean;
  activatedAt: string | null;
  closedAt: string | null;
  sourceSystem: 'NFAAS_SIMULATION';
  origin?: 'SAILOR' | 'COMMAND';
  sponsorId?: string | null;
}

export type ShareLocation = 'OWN' | 'SAILOR' | 'SPOUSE';

export interface Household {
  sponsorId: string;
  phone: string;
  address: string;
  shareLocation: ShareLocation;
}

export interface CommandCertification {
  id: string;
  commandId: string;
  reportingDate: string;
  certifiedBy: string;
  certifiedAt: string;
  confirmed: number;
  outstanding: string[];
}

export interface FamilyMemberReport {
  dependentId: string;
  status: Exclude<FamilyStatus, 'NOT_REPORTED'>;
  generalLocation: string | null;
  safeContact: string | null;
  needs: NeedType[];
  context: string;
}

export interface FamilyAccountabilityRecord {
  id: string;
  emergencyEventId: string;
  sponsorId: string;
  submittedAt: string;
  syncState: SyncState;
  acknowledgment: 'NOT_ACKNOWLEDGED' | 'PROTOTYPE_ACKNOWLEDGED' | 'NFAAS_NOT_CONNECTED';
  members: FamilyMemberReport[];
  createdAt: string;
  updatedAt: string;
  sourceSystem: SourceSystem;
  idempotencyKey: string;
  events: Array<{
    id: string;
    at: string;
    actorId: string;
    summary: string;
    members: FamilyMemberReport[];
    syncState: SyncState;
  }>;
}

export interface NeedsAssessment {
  id: string;
  recordId: string;
  dependentId: string;
  eventId: string;
  sponsorId: string;
  needs: NeedType[];
  context: string;
  createdAt: string;
  updatedAt: string;
  supersededAt: string | null;
  sourceSystem: SourceSystem;
  syncState: SyncState;
}

export interface ApprovalEvent {
  id: string;
  at: string;
  actorId: string;
  action: 'SUBMITTED' | 'APPROVED' | 'DENIED' | 'RETURNED' | 'CANCELLED' | 'INFO_PROVIDED' | 'RESUBMITTED' | 'DRAFT_SAVED';
  note: string | null;
  previousStatus: SnivStatus | null;
  newStatus: SnivStatus;
}

export interface SnivRequest {
  id: string;
  sailorId: string;
  commandId: string;
  supervisorId: string;
  category: SnivCategory;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  remarks: string;
  categoryNote?: string;
  status: SnivStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  sourceSystem: SourceSystem;
  syncState: SyncState;
  idempotencyKey: string;
  approvals: ApprovalEvent[];
}

export interface AppNotification {
  id: string;
  recipientId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  href: string;
  pushEligible: boolean;
  pushDelivery: 'NOT_SENT_NO_PROVIDER';
}

export interface OutboxItem {
  id: string;
  idempotencyKey: string;
  kind: 'MUSTER' | 'FAMILY' | 'SNIV';
  entityId: string;
  sailorId: string;
  createdAt: string;
  baselineUpdatedAt: string;
  status: 'QUEUED' | 'SYNCED' | 'CONFLICT';
  conflictNote: string | null;
}

export type SelfHelpKind = 'CRISIS' | 'SAPR' | 'RIDE' | 'MEDICAL' | 'UNABLE_TO_REACH' | 'OTHER';

export type HelpSubject = 'MYSELF' | 'SHIPMATE' | 'BOTH';

export interface SelfHelpRequest {
  id: string;
  sailorId: string;
  supervisorId: string | null;
  subject: HelpSubject;
  shipmateId: string | null;
  shipmateName: string | null;
  kind: SelfHelpKind;
  summary: string;
  createdAt: string;
}

export type LateReason = 'CAR_TROUBLE' | 'SICKNESS' | 'TRAFFIC' | 'CHILDCARE' | 'OVERSLEPT' | 'OTHER';

export interface LateReport {
  id: string;
  sailorId: string;
  reportingDate: string;
  reason: LateReason;
  note: string;
  createdAt: string;
}

export type FamilyHelpKind = 'SHELTER' | 'MEDICAL' | 'TRANSPORTATION' | 'UNABLE_TO_CONTACT' | 'OTHER';

export interface FamilyHelpRequest {
  id: string;
  sponsorId: string;
  dependentIds: string[];
  kind: FamilyHelpKind;
  location: string;
  remarks: string;
  summary: string;
  createdAt: string;
}

export interface InfoReviewRequest {
  id: string;
  sponsorId: string;
  note: string;
  createdAt: string;
  status: 'SAVED_ON_DEVICE';
  transmitted: false;
}

export interface PrototypeState {
  version: 1;
  sailors: Sailor[];
  command: Command;
  assignments: CommandAssignment[];
  relationships: SupervisorRelationship[];
  dependents: Dependent[];
  periods: MusterPeriod[];
  musters: MusterRecord[];
  emergencies: EmergencyEvent[];
  familyRecords: FamilyAccountabilityRecord[];
  needsAssessments: NeedsAssessment[];
  snivRequests: SnivRequest[];
  notifications: AppNotification[];
  audit: AuditEvent[];
  outbox: OutboxItem[];
  reviewRequests: InfoReviewRequest[];
  preparednessChecks: Record<string, string[]>;
  households: Household[];
  commandCertifications: CommandCertification[];
  selfHelpRequests: SelfHelpRequest[];
  familyHelpRequests: FamilyHelpRequest[];
  lateReports: LateReport[];
}

export interface DomainDeps {
  now: () => Date;
  id: (prefix: string) => string;
  online: boolean;
  forceDutyDay: boolean;
}

export type Mutation =
  | { ok: true; state: PrototypeState; message: string; entityId?: string }
  | { ok: false; error: string };

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type SnivRecurrence = 'NONE' | 'DAILY' | 'WEEKDAYS' | 'WEEKLY';

export interface SnivInput {
  category: SnivCategory;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  remarks: string;
  categoryNote?: string;
  requestId?: string;
  recurrence?: SnivRecurrence;
  untilDate?: string;
}

export interface WorkCenterSettingsInput {
  musterBy: string;
  dutyDays: number[];
  holidays: string[];
}

export const PREPAREDNESS_ITEMS = [
  { id: 'contacts', label: 'Emergency contacts are current' },
  { id: 'meeting', label: 'A family meeting point is agreed' },
  { id: 'supplies', label: 'Basic supplies are set aside' },
  { id: 'plan', label: 'An out-of-area contact is identified' },
] as const;

export const SOURCE_APPLICATION = 'MNP_MOBILE_PROTOTYPE' as const;
