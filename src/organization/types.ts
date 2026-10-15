/**
 * Organizational attributes for accountability rollups.
 * Identifiers stay stable when display names change. Command location is the
 * unit's assigned place, never a sailor's current physical location.
 */

export type OrganizationAttributeKind =
  | 'UNIT_NAME'
  | 'UIC'
  | 'WORK_CENTER'
  | 'TYCOM'
  | 'COMMAND_LOCATION'
  | 'ECHELON';

export interface DataProvenance {
  /** System the value was read from. See ORGANIZATION_INTEGRATION_DEPENDENCIES. */
  sourceSystem: string;
  sourceRecordId: string;
  /** ISO timestamp of the last successful synchronization for this record. */
  synchronizedAt: string;
  /**
   * True only when an authoritative sync wrote the value.
   * A local display edit cannot set this, and cannot replace a true value.
   */
  authoritative: boolean;
}

export interface NavyUnit {
  id: string;
  uic: string;
  name: string;
  shortName: string;
  provenance: DataProvenance;
}

export interface NavyWorkCenter {
  id: string;
  unitId: string;
  /** Short code sailors recognize. Independent of `id`. */
  code: string;
  displayName: string;
  provenance: DataProvenance;
}

export interface TypeCommander {
  id: string;
  code: string;
  name: string;
  provenance: DataProvenance;
}

/** Assigned place of the command. No field on this type is a sailor's whereabouts. */
export interface CommandGeographicLocation {
  id: string;
  installation: string;
  city: string | null;
  state: string | null;
  country: string | null;
  region: string | null;
  provenance: DataProvenance;
}

export interface HigherEchelon {
  id: string;
  name: string;
  provenance: DataProvenance;
}

/**
 * Home command is the sailor's assigned strength.
 * Temporary and operational rows stay visible and are not a second headcount.
 */
export type ReportingRelationship = 'HOME_COMMAND' | 'TEMPORARY' | 'OPERATIONAL';

/** Inclusive start, exclusive end. A UIC or work-center change adds a row; it does not rewrite the old one. */
export interface EffectiveOrganizationAssignment {
  id: string;
  sailorId: string;
  relationship: ReportingRelationship;
  unitId: string;
  uic: string;
  workCenterId: string;
  tycomId: string;
  commandLocationId: string;
  /** Null until an echelon feed is connected. */
  echelonId: string | null;
  effectiveStart: string;
  effectiveEnd: string | null;
  provenance: DataProvenance;
}

export type AccountabilityEventKind = 'DAILY_MUSTER' | 'RECALL' | 'FAMILY_ACCOUNTABILITY' | 'AVAILABILITY';

/** Assignment frozen when the event was recorded. Later org changes do not rewrite it. */
export interface OrganizationalSnapshot {
  assignmentId: string;
  relationship: ReportingRelationship;
  unitId: string;
  uic: string;
  workCenterId: string;
  tycomId: string;
  commandLocationId: string;
  echelonId: string | null;
}

export interface AccountabilityFact {
  id: string;
  sailorId: string;
  kind: AccountabilityEventKind;
  occurredAt: string;
  accounted: boolean;
  acknowledged: boolean;
  certified: boolean;
  isException: boolean;
  organization: OrganizationalSnapshot;
}

/** Where the sailor is right now. Stored apart from command location and never rolled up as one. */
export interface SailorPhysicalLocation {
  sailorId: string;
  description: string;
  recordedAt: string;
}

export interface SailorOrganizationProfile {
  sailorId: string;
  displayName: string;
  home: EffectiveOrganizationAssignment;
  previousHome: EffectiveOrganizationAssignment | null;
  additional: EffectiveOrganizationAssignment[];
  unit: NavyUnit;
  workCenter: NavyWorkCenter;
  previousWorkCenter: NavyWorkCenter | null;
  tycom: TypeCommander;
  commandLocation: CommandGeographicLocation;
  echelon: HigherEchelon | null;
  operationalUnit: NavyUnit | null;
}

export interface OrganizationAttributeDisplay {
  kind: OrganizationAttributeKind;
  label: string;
  /** Stable id for analytics. Not the display string. */
  stableId: string;
  value: string;
  provenance: DataProvenance;
}

export type RollupLevel = 'SAILOR' | 'WORK_CENTER' | 'UNIT' | 'TYCOM' | 'GEOGRAPHIC_LOCATION' | 'ECHELON';

export interface OrganizationFilter {
  tycomId?: string;
  unitId?: string;
  workCenterId?: string;
  commandLocationId?: string;
  echelonId?: string;
}

export interface AccountabilityRollup {
  id: string;
  level: RollupLevel;
  stableIdentifier: string;
  displayName: string;
  assigned: number;
  accountedFor: number;
  unaccountedFor: number;
  musterCompletionPercent: number;
  certificationStatus: 'Certified' | 'Not certified';
  recallAcknowledgmentPercent: number;
  outstandingExceptions: number;
}

export interface IncorrectOrganizationReport {
  id: string;
  sailorId: string;
  attribute: OrganizationAttributeKind;
  note: string;
  routedTo: string;
  createdAt: string;
  appliedToAuthoritativeRecord: false;
}

export interface OrganizationSyncPayload {
  origin: 'AUTHORITATIVE_SYNC';
  synchronizedAt: string;
  units?: NavyUnit[];
  workCenters?: NavyWorkCenter[];
  tycoms?: TypeCommander[];
  locations?: CommandGeographicLocation[];
  echelons?: HigherEchelon[];
  assignments?: EffectiveOrganizationAssignment[];
}

export interface OrganizationSyncResult {
  upserted: string[];
  ignored: { id: string; reason: string }[];
}

export interface LocalDisplayEditResult {
  accepted: false;
  reason: 'AUTHORITATIVE_RECORD';
  authoritativeName: string;
}

export interface TraceRequest {
  sailorId: string;
  eventId: string;
  kind: AccountabilityEventKind;
  on: string;
  accounted: boolean;
  acknowledged: boolean;
  certified: boolean;
  isException: boolean;
}

export const ATTRIBUTE_LABEL: Record<OrganizationAttributeKind, string> = {
  UNIT_NAME: 'Unit Name',
  UIC: 'UIC',
  WORK_CENTER: 'Work Center',
  TYCOM: 'TYCOM',
  COMMAND_LOCATION: 'Command Location',
  ECHELON: 'Higher Echelon',
};

/** Data owner for a correction. Not an assumption that one system owns the attribute. */
export const ATTRIBUTE_REPORT_ROUTE: Record<OrganizationAttributeKind, string> = {
  UNIT_NAME: 'Activity manpower data owner',
  UIC: 'Activity manpower data owner',
  WORK_CENTER: 'Command manpower officer',
  TYCOM: 'Type commander staff',
  COMMAND_LOCATION: 'Installation data owner',
  ECHELON: 'Organizational hierarchy data owner',
};
