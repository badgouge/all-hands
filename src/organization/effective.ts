import type {
  CommandGeographicLocation,
  EffectiveOrganizationAssignment,
  OrganizationalSnapshot,
  ReportingRelationship,
} from './types';

/** Calendar day `YYYY-MM-DD` from a date or timestamp. */
export function calendarDay(value: string): string {
  return value.slice(0, 10);
}

/** Inclusive start, exclusive end. */
export function isEffectiveOn(assignment: EffectiveOrganizationAssignment, on: string): boolean {
  const day = calendarDay(on);
  if (assignment.effectiveStart > day) return false;
  if (assignment.effectiveEnd !== null && assignment.effectiveEnd <= day) return false;
  return true;
}

export function selectEffective(
  assignments: readonly EffectiveOrganizationAssignment[],
  sailorId: string,
  relationship: ReportingRelationship,
  on: string,
): EffectiveOrganizationAssignment | null {
  const matches = assignments.filter(
    (assignment) =>
      assignment.sailorId === sailorId &&
      assignment.relationship === relationship &&
      isEffectiveOn(assignment, on),
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => (a.effectiveStart < b.effectiveStart ? 1 : -1))[0] ?? null;
}

/** Most recently closed home assignment, retained so history survives a move. */
export function selectPreviousHome(
  assignments: readonly EffectiveOrganizationAssignment[],
  sailorId: string,
  on: string,
): EffectiveOrganizationAssignment | null {
  const day = calendarDay(on);
  const closed = assignments.filter(
    (assignment) =>
      assignment.sailorId === sailorId &&
      assignment.relationship === 'HOME_COMMAND' &&
      assignment.effectiveEnd !== null &&
      assignment.effectiveEnd <= day,
  );
  if (closed.length === 0) return null;
  return closed.sort((a, b) => ((a.effectiveEnd ?? '') < (b.effectiveEnd ?? '') ? 1 : -1))[0] ?? null;
}

export function snapshotOf(assignment: EffectiveOrganizationAssignment): OrganizationalSnapshot {
  return {
    assignmentId: assignment.id,
    relationship: assignment.relationship,
    unitId: assignment.unitId,
    uic: assignment.uic,
    workCenterId: assignment.workCenterId,
    tycomId: assignment.tycomId,
    commandLocationId: assignment.commandLocationId,
    echelonId: assignment.echelonId,
  };
}

export function formatCommandLocation(location: CommandGeographicLocation): string {
  const place = [location.city, location.state].filter((part): part is string => Boolean(part)).join(', ');
  if (!place) return `${location.installation} · Location not synchronized`;
  return [location.installation, place, location.country].filter((part): part is string => Boolean(part)).join(' · ');
}
