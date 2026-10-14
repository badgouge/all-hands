import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { TextArea } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAccountability } from '../../app/state/AccountabilityProvider';
import { activeEmergency, listDependents } from '../../domain/accountability';
import { PREPAREDNESS_ITEMS, type FamilyMemberReport } from '../../domain/types';
import { FAMILY_STATUS_LABEL, RELATIONSHIP_LABEL, SYNC_LABEL } from '../../domain/labels';
import { formatDateShort } from '../../domain/time';
import { familyHistory } from '../../domain/viewModels';
import { DependentAccountabilityList, type DraftReport } from '../components/DependentAccountabilityList';
import { BackLink, Screen } from '../components/Screen';

export function FamilyPage() {
  const { state, sailor } = useAccountability();
  if (!sailor) return null;
  const listed = listDependents(state, sailor, sailor.id);
  const event = activeEmergency(state);
  return (
    <Screen>
      <h1>My family</h1>
      {event ? <Alert variant="warning" title="Family accountability required">{event.summary}</Alert> : <p>No active family accountability events.</p>}
      {!listed.ok ? <Alert variant="error">{listed.error}</Alert> : listed.value.length === 0 ? <p>No dependents are registered.</p> : (
        <ul className="space-y-3">
          {listed.value.map((person) => (
            <li key={person.id} className="rounded-lg border border-border p-4">
              <p className="font-semibold">{person.firstName} {person.lastName}</p>
              <p>{RELATIONSHIP_LABEL[person.relationship]}</p>
              <p className="text-muted-foreground">{person.contactSummary}</p>
              <p className="text-muted-foreground">Preparedness {person.preparednessStatus.replaceAll('_', ' ').toLowerCase()}</p>
              <p className="text-muted-foreground">Last verified {formatDateShort(person.lastVerifiedAt.slice(0, 10), state.command.timezone)}</p>
              <p className="text-muted-foreground">From your personnel record. Not editable here.</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2">
        {event ? <Link to="/family/account" className="inline-flex h-12 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground">Account for Family</Link> : null}
        <Link to="/family/review" className="inline-flex h-12 items-center justify-center rounded-md border border-border font-semibold">Review Family Information</Link>
        <Link to="/family/preparedness" className="inline-flex h-12 items-center justify-center rounded-md border border-border font-semibold">Emergency Preparedness</Link>
        <Link to="/family/history" className="inline-flex h-12 items-center justify-center rounded-md border border-border font-semibold">Accountability History</Link>
      </div>
    </Screen>
  );
}

export function FamilyAccountPage() {
  const api = useAccountability();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reports, setReports] = useState<Partial<Record<string, DraftReport>>>(() => {
    const currentEvent = activeEmergency(api.state);
    const sponsorId = api.sailor?.id;
    const existing = currentEvent && sponsorId
      ? api.state.familyRecords.find((item) => item.sponsorId === sponsorId && item.emergencyEventId === currentEvent.id)
      : undefined;
    const initial: Partial<Record<string, DraftReport>> = {};
    for (const member of existing?.members ?? []) initial[member.dependentId] = member;
    return initial;
  });
  if (!api.sailor) return null;
  const event = activeEmergency(api.state);
  const dependents = api.state.dependents.filter((item) => item.sponsorId === api.sailor?.id);

  if (!event) {
    return (
      <Screen>
        <BackLink to="/family">My family</BackLink>
        <h1>Account for family</h1>
        <Alert variant="info" title="No active event">Family accountability opens when an applicable emergency event is active.</Alert>
      </Screen>
    );
  }

  function submit() {
    if (!event) return;
    const members: FamilyMemberReport[] = [];
    for (const person of dependents) {
      const report = reports[person.id];
      if (!report?.status) {
        setError('Choose a status for each family member.');
        return;
      }
      members.push({ ...report, status: report.status });
    }
    if (members.length !== dependents.length) {
      setError('Choose a status for each family member.');
      return;
    }
    const result = api.submitFamily(event.id, members);
    if (!result.ok) setError(result.error);
    else {
      setError(null);
      setDone(true);
    }
  }

  const record = event ? api.state.familyRecords.find((item) => item.sponsorId === api.sailor?.id && item.emergencyEventId === event.id) : undefined;

  return (
    <Screen>
      <BackLink to="/family">My family</BackLink>
      <h1>Account for family</h1>
      <p>{event.name}</p>
      {done && record ? (
        <div className="space-y-3" role="status">
          <Alert variant="success" title="Family Accountability Submitted">
            {record.syncState === 'QUEUED_FOR_SUBMISSION'
              ? 'Saved on this device. Not transmitted to NFAAS or your command.'
              : 'Not transmitted to NFAAS.'}
          </Alert>
          <p className="font-semibold">{SYNC_LABEL[record.syncState]}</p>
          <ul className="space-y-2">
            {record.members.map((member) => {
              const person = dependents.find((item) => item.id === member.dependentId);
              return (
                <li key={member.dependentId} className="rounded-md border border-border p-3">
                  <p className="font-semibold">{person ? `${person.firstName} ${person.lastName}` : 'Family member'}</p>
                  <p>{FAMILY_STATUS_LABEL[member.status]}</p>
                </li>
              );
            })}
          </ul>
          <Link to="/family" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 font-semibold text-primary-foreground">Done</Link>
        </div>
      ) : (
        <>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <DependentAccountabilityList
            dependents={dependents}
            reports={reports}
            onChange={(dependentId, patch) => {
              setReports((current) => {
                const prior = current[dependentId];
                return {
                  ...current,
                  [dependentId]: {
                    dependentId,
                    generalLocation: null,
                    safeContact: null,
                    needs: [],
                    context: '',
                    ...prior,
                    ...patch,
                  },
                };
              });
            }}
          />
          <Button size="lg" className="w-full" onClick={submit}>Submit family report</Button>
        </>
      )}
    </Screen>
  );
}

export function FamilyReviewPage() {
  const api = useAccountability();
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!api.sailor) return null;
  return (
    <Screen>
      <BackLink to="/family">My family</BackLink>
      <h1>Review family information</h1>
      <Alert variant="info" title="Not sent to a Navy system">
        Family records are not edited here. A review request stays on this device.
      </Alert>
      <div className="space-y-1">
        <Label htmlFor="review-note">What should be reviewed?</Label>
        <TextArea id="review-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success" title="Saved on this device">{message}</Alert> : null}
      <Button size="lg" onClick={() => {
        const result = api.requestFamilyReview(note);
        if (!result.ok) setError(result.error);
        else {
          setError(null);
          setMessage(result.message);
        }
      }}>Save review request</Button>
    </Screen>
  );
}

export function FamilyPreparednessPage() {
  const api = useAccountability();
  if (!api.sailor) return null;
  const checked = api.state.preparednessChecks[api.sailor.id] ?? [];
  return (
    <Screen>
      <BackLink to="/family">My family</BackLink>
      <h1>Emergency preparedness</h1>
      <Alert variant="info" title="Saved on this device only">These checks are personal notes. They are not a Navy system of record.</Alert>
      {PREPAREDNESS_ITEMS.map((item) => (
        <label key={item.id} className="flex min-h-11 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            className="size-5"
            checked={checked.includes(item.id)}
            onChange={(event) => api.setPreparedness(item.id, event.target.checked)}
          />
          {item.label}
        </label>
      ))}
    </Screen>
  );
}

export function FamilyHistoryPage() {
  const { state, sailor } = useAccountability();
  if (!sailor) return null;
  const history = familyHistory(state, sailor.id);
  return (
    <Screen>
      <BackLink to="/family">My family</BackLink>
      <h1>Accountability history</h1>
      {history.length === 0 ? <p className="text-muted-foreground">No family accountability reports yet.</p> : history.map((item) => (
        <article key={item.id} className="space-y-2 rounded-lg border border-border p-4">
          <h2 className="text-base">{item.eventName}</h2>
          <p>{item.active ? 'Event active' : 'Event closed'}</p>
          <p>{item.syncLabel}</p>
          <p>{item.acknowledgment}</p>
          <ul>
            {item.members.map((member) => (
              <li key={member.name}>{member.name} · {member.relationship} · {member.status}</li>
            ))}
          </ul>
        </article>
      ))}
    </Screen>
  );
}
