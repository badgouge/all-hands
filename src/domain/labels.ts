import type {
  FamilyStatus,
  MusterStatus,
  NeedType,
  Role,
  Sailor,
  SnivCategory,
  SnivStatus,
  SyncState,
} from './types';

export const MUSTER_STATUS_LABEL: Record<MusterStatus, string> = {
  PRESENT: 'Present / Reporting for Duty',
  TELEWORK: 'Telework / Authorized Remote Duty',
  TAD: 'Temporary Duty / TAD',
  APPROVED_LEAVE: 'Approved Leave',
  AUTHORIZED_ABSENCE: 'Authorized Absence',
  SICK: 'Sick / Unable to Report',
  UNABLE_TO_REPORT: 'Unable to Report / Assistance Needed',
};

export const MUSTER_STATUS_SHORT: Record<MusterStatus, string> = {
  PRESENT: 'Present',
  TELEWORK: 'Telework',
  TAD: 'TAD',
  APPROVED_LEAVE: 'Approved leave',
  AUTHORIZED_ABSENCE: 'Authorized absence',
  SICK: 'Sick',
  UNABLE_TO_REPORT: 'Assistance needed',
};

export const SYNC_LABEL: Record<SyncState, string> = {
  SAVED_ON_DEVICE: 'Saved on Device',
  QUEUED_FOR_SUBMISSION: 'Queued for Submission',
  RECEIVED_BY_SERVICE: 'Received by Service',
  VERIFIED_BY_COMMAND: 'Verified by Command',
};

export const FAMILY_STATUS_LABEL: Record<Exclude<FamilyStatus, 'NOT_REPORTED'>, string> = {
  SAFE: 'Safe / Accounted For',
  DISPLACED: 'Safe but Displaced',
  NEEDS_ASSISTANCE: 'Needs Assistance',
  UNABLE_TO_CONTACT: 'Unable to Contact',
  UNKNOWN: 'Status Unknown',
};

export const NEED_LABEL: Record<NeedType, string> = {
  MEDICAL: 'Medical assistance',
  LODGING: 'Temporary lodging',
  TRANSPORTATION: 'Transportation',
  FOOD_WATER: 'Food and water',
  FINANCIAL: 'Financial assistance',
  FAMILY_CONTACT: 'Family contact assistance',
  OTHER: 'Other urgent need',
};

export const SNIV_CATEGORY_LABEL: Record<SnivCategory, string> = {
  MEDICAL: 'Medical Appointment',
  DENTAL: 'Dental Appointment',
  DEPENDENT: 'Dependent / Family Appointment',
  PERSONAL: 'Personal Appointment',
  ADMINISTRATIVE: 'Administrative Requirement',
  OTHER: 'Other',
};

export const SNIV_STATUS_LABEL: Record<SnivStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  DENIED: 'Denied',
  RETURNED: 'Returned for Information',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

export const ROLE_LABEL: Record<Role, string> = {
  SAILOR: 'Sailor',
  SUPERVISOR: 'Supervisor',
  MUSTER_COORDINATOR: 'Muster Coordinator',
  COMMAND_LEADERSHIP: 'Command Leadership',
  COMMAND_CERTIFIER: 'Command Certifier',
};

export const RELATIONSHIP_LABEL = {
  SPOUSE: 'Spouse',
  CHILD: 'Child',
  PARENT: 'Parent',
  OTHER: 'Other',
} as const;

export function displayName(sailor: Sailor): string {
  const middle = sailor.middleInitial ? ` ${sailor.middleInitial}.` : '';
  return `${sailor.rank} ${sailor.firstName}${middle} ${sailor.lastName}`;
}

export function shortName(sailor: Sailor): string {
  return `${sailor.rank} ${sailor.lastName}`;
}
