import type { FamilyHelpKind, HelpSubject, LateReason, SelfHelpKind } from './types';

export const SELF_HELP_LABEL: Record<SelfHelpKind, string> = {
  CRISIS: 'Military Crisis Line',
  SAPR: 'SAPR Safe Helpline',
  RIDE: 'Need a ride now',
  MEDICAL: 'Medical emergency',
  UNABLE_TO_REACH: 'Cannot reach a shipmate',
  OTHER: 'Other emergency',
};

export const LATE_REASON_LABEL: Record<LateReason, string> = {
  CAR_TROUBLE: 'Car trouble',
  SICKNESS: 'Sickness',
  TRAFFIC: 'Traffic',
  CHILDCARE: 'Childcare',
  OVERSLEPT: 'Overslept',
  OTHER: 'Other',
};

export const FAMILY_HELP_LABEL: Record<FamilyHelpKind, string> = {
  SHELTER: 'Shelter',
  MEDICAL: 'Medical',
  TRANSPORTATION: 'Transportation',
  UNABLE_TO_CONTACT: 'Unable to contact',
  OTHER: 'Other',
};

export const CRISIS_LINE = {
  name: 'Military and Veterans Crisis Line',
  phoneLabel: 'Call 988, then press 1',
  phone: 'tel:988',
  url: 'https://www.veteranscrisisline.net/',
};

export const SAPR_LINE = {
  name: 'DoD Safe Helpline',
  phoneLabel: 'Call 877-995-5247',
  phone: 'tel:8779955247',
  url: 'https://www.safehelpline.org/',
};

/** Crisis and SAPR summaries never include a narrative of what happened. */
export function summarizeSelfHelp(input: {
  kind: SelfHelpKind;
  detail: string;
  notifySupervisor: boolean;
  subject: HelpSubject;
  shipmateName: string | null;
}): string {
  const label = SELF_HELP_LABEL[input.kind];
  const who =
    input.subject === 'MYSELF'
      ? 'For myself'
      : input.subject === 'SHIPMATE'
        ? `For ${input.shipmateName ?? 'a shipmate'}`
        : `For myself and ${input.shipmateName ?? 'a shipmate'}`;
  if (input.kind === 'CRISIS' || input.kind === 'SAPR') {
    const contact = input.notifySupervisor ? ' Asked the supervisor to make contact.' : '';
    return `${who}. ${label}.${contact} No incident details were included.`;
  }
  const extra = input.detail.trim();
  return extra ? `${who}. ${label}. ${extra}` : `${who}. ${label}.`;
}

export function summarizeFamilyHelp(kind: FamilyHelpKind, names: string[], location: string, remarks: string): string {
  const who = names.length > 0 ? names.join(', ') : 'selected dependents';
  const note = remarks.trim();
  const place = location.trim();
  return `${FAMILY_HELP_LABEL[kind]} for ${who}. Location: ${place}.${note ? ` Remarks: ${note}` : ''}`;
}
