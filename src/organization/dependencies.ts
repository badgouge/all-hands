import type { OrganizationAttributeKind } from './types';

export type IntegrationStatus = 'NOT_CONNECTED' | 'MOCK_ONLY';

export interface OrganizationIntegrationDependency {
  attribute: OrganizationAttributeKind | 'DAILY_MUSTER' | 'RECALL' | 'FAMILY_ACCOUNTABILITY' | 'AVAILABILITY';
  status: IntegrationStatus;
  /** Candidate systems. None is treated as the single owner. */
  candidateSources: string[];
  note: string;
}

/**
 * Authoritative sources are not all identified. The mock adapter fills the
 * catalog so the model can be exercised. Connecting a source later means
 * delivering an OrganizationSyncPayload; screens read the service, not the mock.
 */
export const ORGANIZATION_INTEGRATION_DEPENDENCIES: readonly OrganizationIntegrationDependency[] = [
  {
    attribute: 'UNIT_NAME',
    status: 'MOCK_ONLY',
    candidateSources: ['Activity manpower directory', 'Organizational directory'],
    note: 'Official unit names are mocked for known UICs. A local command nickname is not a source.',
  },
  {
    attribute: 'UIC',
    status: 'MOCK_ONLY',
    candidateSources: ['Activity manpower directory'],
    note: 'A UIC change is a new effective assignment to a new unit id. The previous unit row is kept.',
  },
  {
    attribute: 'WORK_CENTER',
    status: 'MOCK_ONLY',
    candidateSources: ['Activity manning document'],
    note: 'No enterprise work-center source is identified. Ids are stable per unit and code. Division labels are not an input.',
  },
  {
    attribute: 'TYCOM',
    status: 'MOCK_ONLY',
    candidateSources: ['Type commander reporting chain'],
    note: 'The reporting-chain system of record is not confirmed. The mock uses CNIC and CNRF so rollups can split.',
  },
  {
    attribute: 'COMMAND_LOCATION',
    status: 'MOCK_ONLY',
    candidateSources: ['Installation directory'],
    note: 'Command location is the installation assigned to the UIC. It is not inferred from where a sailor musters.',
  },
  {
    attribute: 'ECHELON',
    status: 'NOT_CONNECTED',
    candidateSources: ['Organizational hierarchy'],
    note: 'No higher-echelon feed is connected. Assignments leave echelonId empty until a sync provides one.',
  },
  {
    attribute: 'DAILY_MUSTER',
    status: 'MOCK_ONLY',
    candidateSources: ['Muster service'],
    note: 'Sample muster facts are stored with the organization snapshot that was in effect that day.',
  },
  {
    attribute: 'RECALL',
    status: 'MOCK_ONLY',
    candidateSources: ['Recall service'],
    note: 'Recall acknowledgment is a separate fact from muster. The source system is not connected.',
  },
  {
    attribute: 'FAMILY_ACCOUNTABILITY',
    status: 'NOT_CONNECTED',
    candidateSources: ['Family accountability event'],
    note: 'Family facts are recorded only when a family event is authorized. They do not add a second sailor to strength.',
  },
  {
    attribute: 'AVAILABILITY',
    status: 'NOT_CONNECTED',
    candidateSources: ['Sniv workflow'],
    note: 'Availability events can be traced onto the assignment in effect at their start. This module does not own the sniv.',
  },
];
