import { useState } from 'react';
import { Accordion } from '../../components/ui/accordion';
import { Alert } from '../../components/ui/alert';
import { useAccountability } from '../../app/state/AccountabilityProvider';
import { MUSTER_STATUS_LABEL } from '../../domain/labels';
import { currentMuster } from '../../domain/accountability';
import { formatTimestamp, todayInZone } from '../../domain/time';
import { musterCardModel } from '../../domain/viewModels';
import type { MusterStatus } from '../../domain/types';
import { MusterConfirmation } from '../components/MusterConfirmation';
import { MusterHistory } from '../components/MusterHistory';
import { BackLink, Screen } from '../components/Screen';
import { musterTone, StatusBadge } from '../components/StatusBadge';

const choices: Array<{ status: MusterStatus; label: string; description: string }> = [
  { status: 'PRESENT', label: MUSTER_STATUS_LABEL.PRESENT, description: 'I am reporting for duty today.' },
  { status: 'TELEWORK', label: MUSTER_STATUS_LABEL.TELEWORK, description: 'I am working from an authorized remote location. Verification is still required.' },
  { status: 'SICK', label: MUSTER_STATUS_LABEL.SICK, description: 'I cannot report because I am sick. Do not include medical details.' },
  { status: 'UNABLE_TO_REPORT', label: MUSTER_STATUS_LABEL.UNABLE_TO_REPORT, description: 'I need help from my command and cannot report.' },
];

export function MusterPage() {
  const api = useAccountability();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (!api.sailor) return null;
  const now = new Date();
  const today = todayInZone(api.state.command.timezone, now);
  const card = musterCardModel(api.state, api.sailor, now, api.settings.forceDutyDay);
  const record = currentMuster(api.state, api.sailor.id, today);
  const policy = api.state.command.musterPolicy;

  function choose(status: MusterStatus) {
    const result = api.submitMuster(status);
    if (!result.ok) setError(result.error);
    else setDone(true);
  }

  if (done && record) {
    const queued = record.syncState === 'QUEUED_FOR_SUBMISSION' || record.syncState === 'SAVED_ON_DEVICE';
    const verified = record.verification === 'VERIFIED';
    const time = formatTimestamp(record.submittedAt ?? record.updatedAt, api.state.command.timezone);
    const reportedLate = record.events.some((event) => event.note?.includes('deadline'));
    const detail = queued
      ? `Queued for submission at ${time}. Your command has not received this muster.`
      : verified
        ? `Submitted at ${time}. Muster confirmed.`
        : reportedLate
          ? `Submitted at ${time}. You reported after the ${policy.primaryWindowEnd.replace(':', '')} deadline. Awaiting command verification.`
          : `Submitted at ${time}. Awaiting command verification.`;
    return (
      <Screen>
        <MusterConfirmation queued={queued} verified={verified} syncState={record.syncState} detail={detail} />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackLink to="/accountability">Accountability</BackLink>
      <h1>Muster now</h1>
      <StatusBadge tone={musterTone(card.state)}>{card.label}</StatusBadge>
      <p>{card.detail}</p>
      <p className="text-muted-foreground">
        {api.state.command.shortName} deadline {policy.primaryWindowEnd.replace(':', '')}. Early and late reporting are accepted until {policy.lateWindowEnd.replace(':', '')}. Weekends and listed holidays are not required.
      </p>
      {card.approvedAbsenceNote ? <Alert variant="info" title="Approved absence on file">{card.approvedAbsenceNote}. Submitting muster is still required.</Alert> : null}
      {error ? <Alert variant="error" title="Muster was not recorded">{error}</Alert> : null}
      {card.canSubmit ? (
        <div className="grid gap-2">
          {choices.map((choice) => (
            <button
              key={choice.status}
              type="button"
              className="rounded-md border border-border bg-card p-4 text-left"
              onClick={() => choose(choice.status)}
            >
              <span className="block font-semibold">{choice.label}</span>
              <span className="mt-1 block text-muted-foreground">{choice.description}</span>
            </button>
          ))}
        </div>
      ) : null}
      <Accordion title="Statuses you cannot self-assign">
        <ul className="space-y-2">
          <li>Temporary duty is reported by the personnel system.</li>
          <li>Approved leave is reported by the leave system.</li>
          <li>You cannot classify your own absence as approved. An approved sniv request is shown for information and does not complete muster.</li>
        </ul>
      </Accordion>
    </Screen>
  );
}

export function MusterHistoryPage() {
  const { state, sailor } = useAccountability();
  if (!sailor) return null;
  const records = state.musters.filter((record) => record.sailorId === sailor.id);
  return (
    <Screen>
      <BackLink to="/muster">Muster</BackLink>
      <h1>Muster history</h1>
      <MusterHistory periods={state.periods} records={records} timeZone={state.command.timezone} />
    </Screen>
  );
}
