import { calendarDay } from './effective';
import type {
  AccountabilityFact,
  AccountabilityRollup,
  OrganizationFilter,
  RollupLevel,
  SailorOrganizationProfile,
} from './types';

const UNAVAILABLE_ECHELON = 'echelon-unavailable';

/**
 * Groups home-command strength. A sailor with an overlapping operational or
 * temporary assignment is counted once, on the home assignment. Two profile
 * rows for the same sailor count once.
 */
export function rollupAccountability(input: {
  profiles: readonly SailorOrganizationProfile[];
  facts: readonly AccountabilityFact[];
  level: RollupLevel;
  reportingDate: string;
  filter?: OrganizationFilter;
}): AccountabilityRollup[] {
  const day = calendarDay(input.reportingDate);
  const sailors = dedupeHome(input.profiles).filter((profile) => matches(profile, input.filter));
  const groups = new Map<string, SailorOrganizationProfile[]>();
  for (const profile of sailors) {
    const key = groupKey(profile, input.level);
    const bucket = groups.get(key);
    if (bucket) bucket.push(profile);
    else groups.set(key, [profile]);
  }

  const facts = input.facts.filter((fact) => calendarDay(fact.occurredAt) === day);
  const rows: AccountabilityRollup[] = [];
  for (const [key, members] of groups) {
    const ids = new Set(members.map((member) => member.sailorId));
    const muster = latestBySailor(facts, ids, 'DAILY_MUSTER');
    const recall = latestBySailor(facts, ids, 'RECALL');
    let accountedFor = 0;
    let acknowledged = 0;
    let exceptions = 0;
    let certifiedFacts = 0;
    for (const sailorId of ids) {
      const musterFact = muster.get(sailorId);
      if (musterFact?.accounted) accountedFor += 1;
      if (musterFact?.isException) exceptions += 1;
      if (musterFact?.certified) certifiedFacts += 1;
      if (recall.get(sailorId)?.acknowledged) acknowledged += 1;
    }
    const assigned = ids.size;
    const sample = members[0];
    if (!sample) continue;
    rows.push({
      id: `${input.level}:${key}`,
      level: input.level,
      stableIdentifier: key,
      displayName: groupLabel(sample, input.level, key),
      assigned,
      accountedFor,
      unaccountedFor: assigned - accountedFor,
      musterCompletionPercent: percent(accountedFor, assigned),
      certificationStatus: assigned > 0 && accountedFor === assigned && certifiedFacts === assigned ? 'Certified' : 'Not certified',
      recallAcknowledgmentPercent: percent(acknowledged, assigned),
      outstandingExceptions: exceptions,
    });
  }

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function distinctHomeSailors(profiles: readonly SailorOrganizationProfile[]): number {
  return dedupeHome(profiles).length;
}

function dedupeHome(profiles: readonly SailorOrganizationProfile[]): SailorOrganizationProfile[] {
  const bySailor = new Map<string, SailorOrganizationProfile>();
  for (const profile of profiles) {
    if (profile.home.relationship !== 'HOME_COMMAND') continue;
    const existing = bySailor.get(profile.sailorId);
    if (!existing || existing.home.effectiveStart < profile.home.effectiveStart) {
      bySailor.set(profile.sailorId, profile);
    }
  }
  return [...bySailor.values()];
}

function matches(profile: SailorOrganizationProfile, filter: OrganizationFilter | undefined): boolean {
  if (!filter) return true;
  const home = profile.home;
  if (filter.tycomId && home.tycomId !== filter.tycomId) return false;
  if (filter.unitId && home.unitId !== filter.unitId) return false;
  if (filter.workCenterId && home.workCenterId !== filter.workCenterId) return false;
  if (filter.commandLocationId && home.commandLocationId !== filter.commandLocationId) return false;
  if (filter.echelonId && home.echelonId !== filter.echelonId) return false;
  return true;
}

function groupKey(profile: SailorOrganizationProfile, level: RollupLevel): string {
  switch (level) {
    case 'SAILOR':
      return profile.sailorId;
    case 'WORK_CENTER':
      return profile.home.workCenterId;
    case 'UNIT':
      return profile.home.unitId;
    case 'TYCOM':
      return profile.home.tycomId;
    case 'GEOGRAPHIC_LOCATION':
      return profile.home.commandLocationId;
    case 'ECHELON':
      return profile.home.echelonId ?? UNAVAILABLE_ECHELON;
  }
}

function groupLabel(profile: SailorOrganizationProfile, level: RollupLevel, key: string): string {
  switch (level) {
    case 'SAILOR':
      return profile.displayName;
    case 'WORK_CENTER':
      return profile.workCenter.displayName;
    case 'UNIT':
      return profile.unit.uic ? `${profile.unit.name} (${profile.unit.uic})` : profile.unit.name;
    case 'TYCOM':
      return profile.tycom.name;
    case 'GEOGRAPHIC_LOCATION':
      return profile.commandLocation.region ?? profile.commandLocation.installation;
    case 'ECHELON':
      return key === UNAVAILABLE_ECHELON ? 'Higher echelon not synchronized' : (profile.echelon?.name ?? key);
  }
}

function latestBySailor(
  facts: readonly AccountabilityFact[],
  sailors: Set<string>,
  kind: AccountabilityFact['kind'],
): Map<string, AccountabilityFact> {
  const latest = new Map<string, AccountabilityFact>();
  for (const fact of facts) {
    if (fact.kind !== kind || !sailors.has(fact.sailorId)) continue;
    const current = latest.get(fact.sailorId);
    if (!current || current.occurredAt < fact.occurredAt) latest.set(fact.sailorId, fact);
  }
  return latest;
}

function percent(part: number, whole: number): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 100);
}
