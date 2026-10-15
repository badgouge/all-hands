import { describe, expect, it } from 'vitest';
import { ORGANIZATION_INTEGRATION_DEPENDENCIES } from './dependencies';
import { MockNavyOrganizationService } from './mockNavyOrganizationService';
import { distinctHomeSailors } from './rollup';
import type { EffectiveOrganizationAssignment, NavyUnit, NavyWorkCenter } from './types';

const DAY = '2026-10-14';

function service() {
  let sequence = 0;
  return new MockNavyOrganizationService(undefined, {
    now: () => '2026-10-14T18:00:00.000Z',
    id: (prefix) => `${prefix}-${sequence += 1}`,
  });
}

describe('organization profile', () => {
  it('shows the five attributes with stable ids', () => {
    const attributes = service().displayAttributes('sailor-alex', DAY);
    expect(attributes.map((row) => row.label)).toEqual([
      'Unit Name',
      'UIC',
      'Work Center',
      'TYCOM',
      'Command Location',
    ]);
    expect(attributes.map((row) => row.value)).toEqual([
      'Naval Support Activity Meridian Point',
      'N4X901',
      'Medical',
      'Commander, Navy Installations Command',
      'Naval Support Activity Meridian Point · Meridian Point, MS · United States',
    ]);
    expect(new Set(attributes.map((row) => row.stableId)).size).toBe(5);
    expect(attributes.every((row) => row.stableId !== row.value || row.kind === 'UIC')).toBe(true);
    expect(attributes.find((row) => row.kind === 'WORK_CENTER')?.stableId).toBe('wc-N4X901-MED');
  });

  it('keeps the supervisor in the home work center', () => {
    const profile = service().profile('sailor-jordan', DAY);
    expect(profile?.workCenter.displayName).toBe('Medical');
    expect(profile?.home.relationship).toBe('HOME_COMMAND');
  });

  it('preserves the work center that was in effect before a move', () => {
    const org = service();
    expect(org.profile('sailor-drew', '2025-12-15')?.workCenter.id).toBe('wc-N4X901-OPS');
    expect(org.profile('sailor-drew', DAY)?.workCenter.id).toBe('wc-N4X901-MED');
    expect(org.profile('sailor-drew', DAY)?.previousWorkCenter?.id).toBe('wc-N4X901-OPS');
    const historical = org.factsOn('2025-12-15').find((fact) => fact.sailorId === 'sailor-drew');
    expect(historical?.organization.workCenterId).toBe('wc-N4X901-OPS');
  });
});

describe('authoritative sync', () => {
  it('rejects a local rename of an authoritative unit', () => {
    const org = service();
    const result = org.localDisplayEdit({ id: 'unit-N4X901', proposedName: 'Renamed Locally' });
    expect(result.accepted).toBe(false);
    expect(org.profile('sailor-alex', DAY)?.unit.name).toBe('Naval Support Activity Meridian Point');
  });

  it('ignores a non-authoritative name pushed over a synchronized unit', () => {
    const org = service();
    const current = org.profile('sailor-alex', DAY)?.unit;
    if (!current) throw new Error('missing unit');
    const renamed: NavyUnit = { ...current, name: 'Local Nickname', provenance: { ...current.provenance, authoritative: false } };
    const result = org.synchronize({ origin: 'AUTHORITATIVE_SYNC', synchronizedAt: '2026-10-14T00:00:00.000Z', units: [renamed] });
    expect(result.ignored.map((item) => item.id)).toContain('unit-N4X901');
    expect(org.profile('sailor-alex', DAY)?.unit.name).toBe('Naval Support Activity Meridian Point');
  });

  it('renames a work center through sync without changing its id', () => {
    const org = service();
    const center = org.profile('sailor-alex', DAY)?.workCenter;
    if (!center) throw new Error('missing work center');
    const renamed: NavyWorkCenter = { ...center, displayName: 'Medical Department' };
    org.synchronize({ origin: 'AUTHORITATIVE_SYNC', synchronizedAt: '2026-10-14T00:00:00.000Z', workCenters: [renamed] });
    const next = org.profile('sailor-alex', DAY)?.workCenter;
    expect(next?.id).toBe('wc-N4X901-MED');
    expect(next?.displayName).toBe('Medical Department');
  });

  it('refuses to change a UIC on an existing unit id', () => {
    const org = service();
    const unit = org.profile('sailor-alex', DAY)?.unit;
    if (!unit) throw new Error('missing unit');
    const moved: NavyUnit = { ...unit, uic: 'N99999' };
    const result = org.synchronize({ origin: 'AUTHORITATIVE_SYNC', synchronizedAt: '2026-10-14T00:00:00.000Z', units: [moved] });
    expect(result.ignored[0]?.reason).toMatch(/new unit id/);
    expect(org.profile('sailor-alex', DAY)?.unit.uic).toBe('N4X901');
  });

  it('end-dates the open assignment when the sailor moves, and leaves past facts alone', () => {
    const org = service();
    const next: EffectiveOrganizationAssignment = {
      id: 'asg-home-sailor-drew-OPS-2026-11-01',
      sailorId: 'sailor-drew',
      relationship: 'HOME_COMMAND',
      unitId: 'unit-N4X901',
      uic: 'N4X901',
      workCenterId: 'wc-N4X901-OPS',
      tycomId: 'tycom-cnic',
      commandLocationId: 'geo-N4X901',
      echelonId: null,
      effectiveStart: '2026-11-01',
      effectiveEnd: null,
      provenance: {
        sourceSystem: 'mock-activity-manning',
        sourceRecordId: 'asg-home-sailor-drew-OPS-2026-11-01',
        synchronizedAt: '2026-10-14T00:00:00.000Z',
        authoritative: true,
      },
    };
    org.synchronize({ origin: 'AUTHORITATIVE_SYNC', synchronizedAt: '2026-10-14T00:00:00.000Z', assignments: [next] });
    expect(org.profile('sailor-drew', DAY)?.workCenter.id).toBe('wc-N4X901-MED');
    expect(org.profile('sailor-drew', '2026-11-02')?.workCenter.id).toBe('wc-N4X901-OPS');
    expect(org.factsOn('2025-12-15')[0]?.organization.workCenterId).toBe('wc-N4X901-OPS');
    expect(org.factsOn(DAY).find((fact) => fact.id === 'muster-sailor-drew-2026-10-14')?.organization.workCenterId).toBe(
      'wc-N4X901-MED',
    );
  });
});

describe('rollups', () => {
  it('counts each sailor once when a temporary reporting relationship overlaps', () => {
    const org = service();
    const profiles = org.profiles(DAY);
    const parker = profiles.find((profile) => profile.sailorId === 'sailor-parker');
    expect(parker?.additional.map((row) => row.relationship)).toEqual(['OPERATIONAL']);
    expect(parker?.operationalUnit?.id).toBe('unit-N4X220');
    expect(distinctHomeSailors(profiles)).toBe(9);

    const byUnit = org.rollup({ level: 'UNIT', reportingDate: DAY });
    expect(byUnit.reduce((sum, row) => sum + row.assigned, 0)).toBe(9);
    expect(byUnit.find((row) => row.stableIdentifier === 'unit-N4X220')?.assigned).toBe(1);
    expect(byUnit.find((row) => row.stableIdentifier === 'unit-N4X901')?.assigned).toBe(8);
  });

  it('filters and rolls up by work center, UIC, TYCOM, and location', () => {
    const org = service();
    const medical = org.rollup({ level: 'WORK_CENTER', reportingDate: DAY, filter: { workCenterId: 'wc-N4X901-MED' } });
    expect(medical).toHaveLength(1);
    expect(medical[0]).toMatchObject({
      stableIdentifier: 'wc-N4X901-MED',
      assigned: 7,
      accountedFor: 6,
      unaccountedFor: 1,
      outstandingExceptions: 2,
      certificationStatus: 'Not certified',
    });

    const harbor = org.rollup({ level: 'UNIT', reportingDate: DAY, filter: { unitId: 'unit-N4X220' } });
    expect(harbor[0]?.displayName).toContain('N4X220');
    expect(harbor[0]?.certificationStatus).toBe('Certified');

    const tycom = org.rollup({ level: 'TYCOM', reportingDate: DAY });
    expect(tycom.map((row) => row.stableIdentifier).sort()).toEqual(['tycom-cnic', 'tycom-cnrf']);

    const southeast = org.rollup({
      level: 'GEOGRAPHIC_LOCATION',
      reportingDate: DAY,
      filter: { commandLocationId: 'geo-N4X901' },
    });
    expect(southeast[0]?.displayName).toBe('Southeast');
    expect(southeast[0]?.assigned).toBe(8);
  });

  it('does not let a family fact or a physical location change command strength', () => {
    const org = service();
    org.recordPhysicalLocation({
      sailorId: 'sailor-alex',
      description: 'Barracks 4, temporary berthing',
      recordedAt: '2026-10-14T16:00:00.000Z',
    });
    const before = org.rollup({ level: 'GEOGRAPHIC_LOCATION', reportingDate: DAY });
    expect(org.physicalLocation('sailor-alex')?.description).toMatch(/Barracks 4/);
    expect(org.profile('sailor-alex', DAY)?.commandLocation.id).toBe('geo-N4X901');
    expect(org.rollup({ level: 'GEOGRAPHIC_LOCATION', reportingDate: DAY })).toEqual(before);
    expect(org.factsOn(DAY).some((fact) => fact.kind === 'FAMILY_ACCOUNTABILITY')).toBe(true);
    expect(org.rollup({ level: 'SAILOR', reportingDate: DAY }).reduce((sum, row) => sum + row.assigned, 0)).toBe(9);
  });

  it('traces a new availability event to the assignment in effect that day', () => {
    const org = service();
    const fact = org.trace({
      sailorId: 'sailor-drew',
      eventId: 'sniv-drew-1',
      kind: 'AVAILABILITY',
      on: '2025-12-15T08:00:00.000Z',
      accounted: true,
      acknowledged: true,
      certified: false,
      isException: false,
    });
    expect(fact.organization.workCenterId).toBe('wc-N4X901-OPS');
    expect(fact.organization.assignmentId).toBe('asg-home-sailor-drew-OPS-2024-01-01');
  });

  it('groups by echelon once a sync provides the relationship', () => {
    const org = service();
    expect(org.rollup({ level: 'ECHELON', reportingDate: DAY })).toEqual([
      expect.objectContaining({ stableIdentifier: 'echelon-unavailable', assigned: 9 }),
    ]);
    const home = org.profile('sailor-lee', DAY)?.home;
    if (!home) throw new Error('missing assignment');
    org.synchronize({
      origin: 'AUTHORITATIVE_SYNC',
      synchronizedAt: '2026-10-14T00:00:00.000Z',
      echelons: [
        {
          id: 'echelon-cnrf',
          name: 'Navy Reserve Force',
          provenance: {
            sourceSystem: 'mock-reporting-chain',
            sourceRecordId: 'echelon-cnrf',
            synchronizedAt: '2026-10-14T00:00:00.000Z',
            authoritative: true,
          },
        },
      ],
      assignments: [{ ...home, echelonId: 'echelon-cnrf' }],
    });
    const rows = org.rollup({ level: 'ECHELON', reportingDate: DAY });
    expect(rows.find((row) => row.stableIdentifier === 'echelon-cnrf')).toMatchObject({
      displayName: 'Navy Reserve Force',
      assigned: 1,
    });
    expect(rows.find((row) => row.stableIdentifier === 'echelon-unavailable')?.assigned).toBe(8);
  });
});

describe('corrections and integration notes', () => {
  it('routes an incorrect-information report without changing the record', () => {
    const org = service();
    const report = org.reportIncorrectInformation({
      sailorId: 'sailor-alex',
      attribute: 'UIC',
      note: 'UIC on my profile does not match my orders.',
    });
    expect(report.routedTo).toBe('Activity manpower data owner');
    expect(report.appliedToAuthoritativeRecord).toBe(false);
    expect(org.profile('sailor-alex', DAY)?.unit.uic).toBe('N4X901');
  });

  it('documents a source dependency for every organizational attribute', () => {
    const attributes = ['UNIT_NAME', 'UIC', 'WORK_CENTER', 'TYCOM', 'COMMAND_LOCATION', 'ECHELON'];
    for (const attribute of attributes) {
      const dependency = ORGANIZATION_INTEGRATION_DEPENDENCIES.find((item) => item.attribute === attribute);
      expect(dependency?.note.length).toBeGreaterThan(0);
      expect(dependency?.candidateSources.length).toBeGreaterThan(0);
    }
    expect(ORGANIZATION_INTEGRATION_DEPENDENCIES.find((item) => item.attribute === 'ECHELON')?.status).toBe('NOT_CONNECTED');
  });
});
