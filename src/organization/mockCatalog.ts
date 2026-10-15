import type {
  AccountabilityFact,
  CommandGeographicLocation,
  DataProvenance,
  EffectiveOrganizationAssignment,
  HigherEchelon,
  NavyUnit,
  NavyWorkCenter,
  TypeCommander,
} from './types';

const SYNCED = '2026-10-01T00:00:00.000Z';

export interface OrganizationCatalog {
  sailors: { id: string; displayName: string }[];
  units: NavyUnit[];
  workCenters: NavyWorkCenter[];
  tycoms: TypeCommander[];
  locations: CommandGeographicLocation[];
  echelons: HigherEchelon[];
  assignments: EffectiveOrganizationAssignment[];
  facts: AccountabilityFact[];
}

function provenance(system: string, record: string, authoritative = true): DataProvenance {
  return { sourceSystem: system, sourceRecordId: record, synchronizedAt: SYNCED, authoritative };
}

const directory = 'mock-navy-organization-directory';
const manning = 'mock-activity-manning';
const chain = 'mock-reporting-chain';
const installation = 'mock-installation-directory';

/**
 * Fictional catalog. N4X901 is the home command. N4X220 exists so UIC, TYCOM,
 * and location rollups have a second bucket. Parker also reports operationally
 * to N4X220; that row is not home-command strength.
 */
export function createOrganizationCatalog(): OrganizationCatalog {
  const cnic: TypeCommander = {
    id: 'tycom-cnic',
    code: 'CNIC',
    name: 'Commander, Navy Installations Command',
    provenance: provenance(chain, 'tycom-cnic'),
  };
  const cnrf: TypeCommander = {
    id: 'tycom-cnrf',
    code: 'CNRF',
    name: 'Commander, Navy Reserve Force',
    provenance: provenance(chain, 'tycom-cnrf'),
  };

  const meridian: NavyUnit = {
    id: 'unit-N4X901',
    uic: 'N4X901',
    name: 'Naval Support Activity Meridian Point',
    shortName: 'NSA Meridian Point',
    provenance: provenance(directory, 'unit-N4X901'),
  };
  const harbor: NavyUnit = {
    id: 'unit-N4X220',
    uic: 'N4X220',
    name: 'Naval Medical Readiness Unit Harbor Station',
    shortName: 'NMRU Harbor Station',
    provenance: provenance(directory, 'unit-N4X220'),
  };

  const meridianPlace: CommandGeographicLocation = {
    id: 'geo-N4X901',
    installation: 'Naval Support Activity Meridian Point',
    city: 'Meridian Point',
    state: 'MS',
    country: 'United States',
    region: 'Southeast',
    provenance: provenance(installation, 'geo-N4X901'),
  };
  const harborPlace: CommandGeographicLocation = {
    id: 'geo-N4X220',
    installation: 'Naval Station Harbor Station',
    city: 'Harbor Station',
    state: 'VA',
    country: 'United States',
    region: 'Mid-Atlantic',
    provenance: provenance(installation, 'geo-N4X220'),
  };

  const medical: NavyWorkCenter = center('wc-N4X901-MED', meridian.id, 'MED', 'Medical');
  const operations: NavyWorkCenter = center('wc-N4X901-OPS', meridian.id, 'OPS', 'Operations');
  const command: NavyWorkCenter = center('wc-N4X901-CMD', meridian.id, 'CMD', 'Command');
  const dental: NavyWorkCenter = center('wc-N4X220-DEN', harbor.id, 'DEN', 'Dental');

  const sailors = [
    ['sailor-alex', 'HM2 Rivera, Alex'],
    ['sailor-jordan', 'IT1 Hale, Jordan'],
    ['sailor-xo', 'CDR Cho, Ellen'],
    ['sailor-samir', 'HM3 Patel, Samir'],
    ['sailor-rowan', 'HN Chen, Rowan'],
    ['sailor-quinn', 'HM3 Alvarez, Quinn'],
    ['sailor-drew', 'HN Okonkwo, Drew'],
    ['sailor-parker', 'HM2 Singh, Parker'],
    ['sailor-lee', 'HM2 Lee, Morgan'],
  ] as const;

  const home = (
    sailorId: string,
    workCenter: NavyWorkCenter,
    unit: NavyUnit,
    tycom: TypeCommander,
    place: CommandGeographicLocation,
    start: string,
    end: string | null,
  ): EffectiveOrganizationAssignment => ({
    id: `asg-home-${sailorId}-${workCenter.code}-${start}`,
    sailorId,
    relationship: 'HOME_COMMAND',
    unitId: unit.id,
    uic: unit.uic,
    workCenterId: workCenter.id,
    tycomId: tycom.id,
    commandLocationId: place.id,
    echelonId: null,
    effectiveStart: start,
    effectiveEnd: end,
    provenance: provenance(manning, `asg-home-${sailorId}-${workCenter.code}-${start}`),
  });

  const medicalSailors = ['sailor-alex', 'sailor-jordan', 'sailor-samir', 'sailor-rowan', 'sailor-quinn', 'sailor-parker'];
  const assignments: EffectiveOrganizationAssignment[] = [
    ...medicalSailors.map((id) => home(id, medical, meridian, cnic, meridianPlace, '2024-01-01', null)),
    home('sailor-drew', operations, meridian, cnic, meridianPlace, '2024-01-01', '2026-01-01'),
    home('sailor-drew', medical, meridian, cnic, meridianPlace, '2026-01-01', null),
    home('sailor-xo', command, meridian, cnic, meridianPlace, '2024-01-01', null),
    home('sailor-lee', dental, harbor, cnrf, harborPlace, '2024-01-01', null),
    {
      id: 'asg-operational-sailor-parker',
      sailorId: 'sailor-parker',
      relationship: 'OPERATIONAL',
      unitId: harbor.id,
      uic: harbor.uic,
      workCenterId: dental.id,
      tycomId: cnrf.id,
      commandLocationId: harborPlace.id,
      echelonId: null,
      effectiveStart: '2026-06-01',
      effectiveEnd: null,
      provenance: provenance(chain, 'asg-operational-sailor-parker'),
    },
  ];

  const on = '2026-10-14T12:00:00.000Z';
  const facts: AccountabilityFact[] = [
    ...sailors.map(([id]) => muster(id, on, musterStatus(id))),
    ...sailors.map(([id]) => recall(id, on)),
    familyFact(),
    drewHistoricalMuster(),
  ];

  return {
    sailors: sailors.map(([id, displayName]) => ({ id, displayName })),
    units: [meridian, harbor],
    workCenters: [medical, operations, command, dental],
    tycoms: [cnic, cnrf],
    locations: [meridianPlace, harborPlace],
    echelons: [],
    assignments,
    facts,
  };
}

function center(id: string, unitId: string, code: string, displayName: string): NavyWorkCenter {
  return {
    id,
    unitId,
    code,
    displayName,
    provenance: provenance('mock-activity-manning', id),
  };
}

function musterStatus(sailorId: string): { accounted: boolean; certified: boolean; isException: boolean } {
  if (sailorId === 'sailor-quinn') return { accounted: false, certified: false, isException: true };
  if (sailorId === 'sailor-samir') return { accounted: true, certified: true, isException: true };
  return { accounted: true, certified: true, isException: false };
}

function currentWorkCenter(sailorId: string): string {
  if (sailorId === 'sailor-xo') return 'wc-N4X901-CMD';
  if (sailorId === 'sailor-lee') return 'wc-N4X220-DEN';
  return 'wc-N4X901-MED';
}

function currentUnit(sailorId: string): { unitId: string; uic: string; tycomId: string; commandLocationId: string } {
  if (sailorId === 'sailor-lee') {
    return { unitId: 'unit-N4X220', uic: 'N4X220', tycomId: 'tycom-cnrf', commandLocationId: 'geo-N4X220' };
  }
  return { unitId: 'unit-N4X901', uic: 'N4X901', tycomId: 'tycom-cnic', commandLocationId: 'geo-N4X901' };
}

function muster(
  sailorId: string,
  occurredAt: string,
  status: { accounted: boolean; certified: boolean; isException: boolean },
): AccountabilityFact {
  const place = currentUnit(sailorId);
  return {
    id: `muster-${sailorId}-2026-10-14`,
    sailorId,
    kind: 'DAILY_MUSTER',
    occurredAt,
    accounted: status.accounted,
    acknowledged: false,
    certified: status.certified,
    isException: status.isException,
    organization: {
      assignmentId: `asg-home-${sailorId}-current`,
      relationship: 'HOME_COMMAND',
      unitId: place.unitId,
      uic: place.uic,
      workCenterId: currentWorkCenter(sailorId),
      tycomId: place.tycomId,
      commandLocationId: place.commandLocationId,
      echelonId: null,
    },
  };
}

function recall(sailorId: string, occurredAt: string): AccountabilityFact {
  const place = currentUnit(sailorId);
  const acknowledged = sailorId !== 'sailor-quinn' && sailorId !== 'sailor-rowan';
  return {
    id: `recall-${sailorId}-2026-10-14`,
    sailorId,
    kind: 'RECALL',
    occurredAt,
    accounted: false,
    acknowledged,
    certified: false,
    isException: false,
    organization: {
      assignmentId: `asg-home-${sailorId}-current`,
      relationship: 'HOME_COMMAND',
      unitId: place.unitId,
      uic: place.uic,
      workCenterId: currentWorkCenter(sailorId),
      tycomId: place.tycomId,
      commandLocationId: place.commandLocationId,
      echelonId: null,
    },
  };
}

function familyFact(): AccountabilityFact {
  return {
    id: 'family-sailor-alex-2026-10-14',
    sailorId: 'sailor-alex',
    kind: 'FAMILY_ACCOUNTABILITY',
    occurredAt: '2026-10-14T15:00:00.000Z',
    accounted: true,
    acknowledged: true,
    certified: false,
    isException: false,
    organization: {
      assignmentId: 'asg-home-sailor-alex-MED-2024-01-01',
      relationship: 'HOME_COMMAND',
      unitId: 'unit-N4X901',
      uic: 'N4X901',
      workCenterId: 'wc-N4X901-MED',
      tycomId: 'tycom-cnic',
      commandLocationId: 'geo-N4X901',
      echelonId: null,
    },
  };
}

function drewHistoricalMuster(): AccountabilityFact {
  return {
    id: 'muster-sailor-drew-2025-12-15',
    sailorId: 'sailor-drew',
    kind: 'DAILY_MUSTER',
    occurredAt: '2025-12-15T12:00:00.000Z',
    accounted: true,
    acknowledged: false,
    certified: true,
    isException: false,
    organization: {
      assignmentId: 'asg-home-sailor-drew-OPS-2024-01-01',
      relationship: 'HOME_COMMAND',
      unitId: 'unit-N4X901',
      uic: 'N4X901',
      workCenterId: 'wc-N4X901-OPS',
      tycomId: 'tycom-cnic',
      commandLocationId: 'geo-N4X901',
      echelonId: null,
    },
  };
}
