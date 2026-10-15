import { formatCommandLocation, selectEffective, selectPreviousHome, snapshotOf } from './effective';
import { createOrganizationCatalog, type OrganizationCatalog } from './mockCatalog';
import { rollupAccountability } from './rollup';
import {
  ATTRIBUTE_LABEL,
  ATTRIBUTE_REPORT_ROUTE,
  type AccountabilityFact,
  type CommandGeographicLocation,
  type EffectiveOrganizationAssignment,
  type HigherEchelon,
  type IncorrectOrganizationReport,
  type LocalDisplayEditResult,
  type NavyUnit,
  type NavyWorkCenter,
  type OrganizationAttributeDisplay,
  type OrganizationFilter,
  type OrganizationSyncPayload,
  type OrganizationSyncResult,
  type RollupLevel,
  type SailorOrganizationProfile,
  type SailorPhysicalLocation,
  type TraceRequest,
  type TypeCommander,
} from './types';

export interface OrganizationDeps {
  now: () => string;
  id: (prefix: string) => string;
}

const defaultDeps: OrganizationDeps = {
  now: () => new Date().toISOString(),
  id: (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`,
};

/**
 * In-memory adapter. Authoritative fields change only through `synchronize`.
 * Display edits and physical-location notes are refused or stored beside the
 * catalog, never written over a unit, UIC, work center, TYCOM, or command location.
 */
export class MockNavyOrganizationService implements NavyOrganizationService {
  private readonly sailors: Map<string, string>;
  private readonly units: Map<string, NavyUnit>;
  private readonly workCenters: Map<string, NavyWorkCenter>;
  private readonly tycoms: Map<string, TypeCommander>;
  private readonly locations: Map<string, CommandGeographicLocation>;
  private readonly echelons: Map<string, HigherEchelon>;
  private assignments: EffectiveOrganizationAssignment[];
  private facts: AccountabilityFact[];
  private readonly physical = new Map<string, SailorPhysicalLocation>();
  private readonly reports: IncorrectOrganizationReport[] = [];

  constructor(
    catalog: OrganizationCatalog = createOrganizationCatalog(),
    private readonly deps: OrganizationDeps = defaultDeps,
  ) {
    this.sailors = new Map(catalog.sailors.map((sailor) => [sailor.id, sailor.displayName]));
    this.units = new Map(catalog.units.map((unit) => [unit.id, clone(unit)]));
    this.workCenters = new Map(catalog.workCenters.map((center) => [center.id, clone(center)]));
    this.tycoms = new Map(catalog.tycoms.map((tycom) => [tycom.id, clone(tycom)]));
    this.locations = new Map(catalog.locations.map((location) => [location.id, clone(location)]));
    this.echelons = new Map(catalog.echelons.map((echelon) => [echelon.id, clone(echelon)]));
    this.assignments = catalog.assignments.map((assignment) => clone(assignment));
    this.facts = catalog.facts.map((fact) => clone(fact));
  }

  profile(sailorId: string, on: string): SailorOrganizationProfile | null {
    const home = selectEffective(this.assignments, sailorId, 'HOME_COMMAND', on);
    if (!home) return null;
    const unit = this.units.get(home.unitId);
    const workCenter = this.workCenters.get(home.workCenterId);
    const tycom = this.tycoms.get(home.tycomId);
    const commandLocation = this.locations.get(home.commandLocationId);
    if (!unit || !workCenter || !tycom || !commandLocation) return null;

    const previousHome = selectPreviousHome(this.assignments, sailorId, on);
    const previousWorkCenter = previousHome ? this.workCenters.get(previousHome.workCenterId) ?? null : null;
    const additional = this.assignments.filter(
      (assignment) =>
        assignment.sailorId === sailorId &&
        assignment.relationship !== 'HOME_COMMAND' &&
        assignment.effectiveStart <= on.slice(0, 10) &&
        (assignment.effectiveEnd === null || assignment.effectiveEnd > on.slice(0, 10)),
    );
    const operational = additional.find((assignment) => assignment.relationship === 'OPERATIONAL');
    return {
      sailorId,
      displayName: this.sailors.get(sailorId) ?? sailorId,
      home,
      previousHome,
      additional,
      unit,
      workCenter,
      previousWorkCenter,
      tycom,
      commandLocation,
      echelon: home.echelonId ? this.echelons.get(home.echelonId) ?? null : null,
      operationalUnit: operational ? this.units.get(operational.unitId) ?? null : null,
    };
  }

  profiles(on: string): SailorOrganizationProfile[] {
    const ids = new Set(this.assignments.map((assignment) => assignment.sailorId));
    return [...ids].flatMap((sailorId) => {
      const profile = this.profile(sailorId, on);
      return profile ? [profile] : [];
    });
  }

  displayAttributes(sailorId: string, on: string): OrganizationAttributeDisplay[] {
    const profile = this.profile(sailorId, on);
    if (!profile) return [];
    return [
      attribute('UNIT_NAME', profile.unit.id, profile.unit.name, profile.unit.provenance),
      attribute('UIC', profile.unit.uic, profile.unit.uic, profile.unit.provenance),
      attribute('WORK_CENTER', profile.workCenter.id, profile.workCenter.displayName, profile.workCenter.provenance),
      attribute('TYCOM', profile.tycom.id, profile.tycom.name, profile.tycom.provenance),
      attribute(
        'COMMAND_LOCATION',
        profile.commandLocation.id,
        formatCommandLocation(profile.commandLocation),
        profile.commandLocation.provenance,
      ),
    ];
  }

  factsOn(reportingDate: string): AccountabilityFact[] {
    const day = reportingDate.slice(0, 10);
    return this.facts.filter((fact) => fact.occurredAt.slice(0, 10) === day).map((fact) => clone(fact));
  }

  trace(event: TraceRequest): AccountabilityFact {
    const home = selectEffective(this.assignments, event.sailorId, 'HOME_COMMAND', event.on);
    if (!home) throw new Error(`No home-command assignment for ${event.sailorId} on ${event.on}.`);
    const fact: AccountabilityFact = {
      id: this.deps.id('trace'),
      sailorId: event.sailorId,
      kind: event.kind,
      occurredAt: event.on,
      accounted: event.accounted,
      acknowledged: event.acknowledged,
      certified: event.certified,
      isException: event.isException,
      organization: snapshotOf(home),
    };
    this.facts.push(fact);
    return clone(fact);
  }

  synchronize(payload: OrganizationSyncPayload): OrganizationSyncResult {
    const upserted: string[] = [];
    const ignored: { id: string; reason: string }[] = [];

    for (const unit of payload.units ?? []) {
      const existing = this.units.get(unit.id);
      if (existing && existing.uic !== unit.uic) {
        ignored.push({ id: unit.id, reason: 'UIC changes require a new unit id and a new effective assignment.' });
        continue;
      }
      if (existing?.provenance.authoritative && !unit.provenance.authoritative) {
        ignored.push({ id: unit.id, reason: 'A local display value cannot overwrite an authoritative unit name.' });
        continue;
      }
      this.units.set(unit.id, { ...clone(unit), provenance: { ...unit.provenance, synchronizedAt: payload.synchronizedAt } });
      upserted.push(unit.id);
    }

    for (const center of payload.workCenters ?? []) {
      const existing = this.workCenters.get(center.id);
      if (existing?.provenance.authoritative && !center.provenance.authoritative) {
        ignored.push({ id: center.id, reason: 'A local display value cannot overwrite an authoritative work center.' });
        continue;
      }
      this.workCenters.set(center.id, {
        ...clone(center),
        provenance: { ...center.provenance, synchronizedAt: payload.synchronizedAt },
      });
      upserted.push(center.id);
    }

    for (const tycom of payload.tycoms ?? []) {
      this.tycoms.set(tycom.id, { ...clone(tycom), provenance: { ...tycom.provenance, synchronizedAt: payload.synchronizedAt } });
      upserted.push(tycom.id);
    }
    for (const location of payload.locations ?? []) {
      this.locations.set(location.id, {
        ...clone(location),
        provenance: { ...location.provenance, synchronizedAt: payload.synchronizedAt },
      });
      upserted.push(location.id);
    }
    for (const echelon of payload.echelons ?? []) {
      this.echelons.set(echelon.id, {
        ...clone(echelon),
        provenance: { ...echelon.provenance, synchronizedAt: payload.synchronizedAt },
      });
      upserted.push(echelon.id);
    }

    for (const assignment of payload.assignments ?? []) {
      this.endDateOpenAssignments(assignment);
      const next = clone(assignment);
      next.provenance = { ...next.provenance, synchronizedAt: payload.synchronizedAt };
      const index = this.assignments.findIndex((row) => row.id === next.id);
      if (index >= 0) this.assignments[index] = next;
      else this.assignments.push(next);
      upserted.push(next.id);
    }

    return { upserted, ignored };
  }

  localDisplayEdit(input: { id: string; proposedName: string }): LocalDisplayEditResult {
    const unit = this.units.get(input.id);
    const center = this.workCenters.get(input.id);
    const tycom = this.tycoms.get(input.id);
    const location = this.locations.get(input.id);
    const authoritativeName = unit?.name ?? center?.displayName ?? tycom?.name ?? location?.installation ?? input.proposedName;
    return { accepted: false, reason: 'AUTHORITATIVE_RECORD', authoritativeName };
  }

  reportIncorrectInformation(input: {
    sailorId: string;
    attribute: IncorrectOrganizationReport['attribute'];
    note: string;
  }): IncorrectOrganizationReport {
    const report: IncorrectOrganizationReport = {
      id: this.deps.id('org-report'),
      sailorId: input.sailorId,
      attribute: input.attribute,
      note: input.note,
      routedTo: ATTRIBUTE_REPORT_ROUTE[input.attribute],
      createdAt: this.deps.now(),
      appliedToAuthoritativeRecord: false,
    };
    this.reports.push(report);
    return report;
  }

  recordPhysicalLocation(location: SailorPhysicalLocation): void {
    this.physical.set(location.sailorId, { ...location });
  }

  physicalLocation(sailorId: string): SailorPhysicalLocation | null {
    const location = this.physical.get(sailorId);
    return location ? { ...location } : null;
  }

  rollup(input: { level: RollupLevel; reportingDate: string; filter?: OrganizationFilter }) {
    return rollupAccountability({
      profiles: this.profiles(input.reportingDate),
      facts: this.facts,
      level: input.level,
      reportingDate: input.reportingDate,
      filter: input.filter,
    });
  }

  private endDateOpenAssignments(next: EffectiveOrganizationAssignment): void {
    for (const row of this.assignments) {
      if (row.id === next.id) continue;
      if (row.sailorId !== next.sailorId || row.relationship !== next.relationship) continue;
      if (row.effectiveEnd !== null) continue;
      if (row.effectiveStart >= next.effectiveStart) continue;
      row.effectiveEnd = next.effectiveStart;
    }
  }
}

export interface NavyOrganizationService {
  profile(sailorId: string, on: string): SailorOrganizationProfile | null;
  profiles(on: string): SailorOrganizationProfile[];
  displayAttributes(sailorId: string, on: string): OrganizationAttributeDisplay[];
  factsOn(reportingDate: string): AccountabilityFact[];
  trace(event: TraceRequest): AccountabilityFact;
  synchronize(payload: OrganizationSyncPayload): OrganizationSyncResult;
  localDisplayEdit(input: { id: string; proposedName: string }): LocalDisplayEditResult;
  reportIncorrectInformation(input: {
    sailorId: string;
    attribute: IncorrectOrganizationReport['attribute'];
    note: string;
  }): IncorrectOrganizationReport;
  recordPhysicalLocation(location: SailorPhysicalLocation): void;
  physicalLocation(sailorId: string): SailorPhysicalLocation | null;
  rollup(input: { level: RollupLevel; reportingDate: string; filter?: OrganizationFilter }): ReturnType<typeof rollupAccountability>;
}

function attribute(
  kind: OrganizationAttributeDisplay['kind'],
  stableId: string,
  value: string,
  provenance: OrganizationAttributeDisplay['provenance'],
): OrganizationAttributeDisplay {
  return { kind, label: ATTRIBUTE_LABEL[kind], stableId, value, provenance };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
