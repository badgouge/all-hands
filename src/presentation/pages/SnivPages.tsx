import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { TextArea } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAccountability } from '../../app/state/AccountabilityProvider';
import { supervisorFor } from '../../domain/accountability';
import { displayName, SNIV_CATEGORY_LABEL, SNIV_STATUS_LABEL, SYNC_LABEL } from '../../domain/labels';
import { addDays, formatDateLong, formatDuration, formatMilitary, formatTimestamp, todayInZone } from '../../domain/time';
import type { SnivInput, SnivRequest } from '../../domain/types';
import { SnivRequestForm } from '../components/SnivRequestForm';
import { SnivRequestHistory } from '../components/SnivRequestHistory';
import { BackLink, Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';

export function SnivListPage() {
  const { state, sailor } = useAccountability();
  if (!sailor) return null;
  const today = todayInZone(state.command.timezone, new Date());
  const mine = state.snivRequests.filter((request) => request.sailorId === sailor.id);
  const upcoming = mine.filter((request) => request.status === 'APPROVED' && request.endDate >= today);
  const pending = mine.filter((request) => request.status === 'PENDING_APPROVAL' || request.status === 'RETURNED' || request.status === 'DRAFT');
  const past = mine.filter((request) => !upcoming.includes(request) && !pending.includes(request));
  return (
    <Screen>
      <div className="flex items-center justify-between gap-3">
        <h1>Snivel Log</h1>
      </div>
      <Link to="/requests/new" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 font-semibold text-primary-foreground">
        Request Time Away
      </Link>
      <SnivRequestHistory upcoming={upcoming} pending={pending} past={past} timeZone={state.command.timezone} />
    </Screen>
  );
}

export function SnivFormPage() {
  const api = useAccountability();
  const navigate = useNavigate();
  const { id } = useParams();
  const [error, setError] = useState<string | null>(null);
  if (!api.sailor) return null;
  const existing = id ? api.state.snivRequests.find((request) => request.id === id && request.sailorId === api.sailor?.id) : undefined;
  if (id && !existing) return <Screen><Alert variant="error" title="Not found">That request is not available.</Alert></Screen>;
  const today = todayInZone(api.state.command.timezone, new Date());
  const supervisor = supervisorFor(api.state, api.sailor.id);
  const initial: SnivInput = existing
    ? {
        requestId: existing.id,
        category: existing.category,
        date: existing.date,
        endDate: existing.endDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
        remarks: existing.remarks,
      }
    : {
        category: 'MEDICAL',
        date: addDays(today, 1),
        endDate: addDays(today, 1),
        startTime: '09:00',
        endTime: '11:00',
        remarks: '',
      };

  function finish(result: { ok: true; entityId?: string; message: string } | { ok: false; error: string }) {
    if (!result.ok) setError(result.error);
    else if (result.entityId) navigate(`/requests/${result.entityId}`);
  }

  return (
    <Screen>
      <BackLink to="/requests">Snivel Log</BackLink>
      <h1>{existing ? 'Update request' : 'Request time away'}</h1>
      {error ? <Alert variant="error" title="Request was not saved">{error}</Alert> : null}
      <SnivRequestForm
        state={api.state}
        supervisorName={supervisor ? displayName(supervisor) : null}
        initial={initial}
        onSubmit={(input) => finish(api.submitSniv(input))}
        onSaveDraft={(input) => finish(api.saveSnivDraft(input))}
      />
    </Screen>
  );
}

export function SnivDetailPage() {
  const api = useAccountability();
  const { id } = useParams();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  if (!api.sailor || !id) return null;
  const request = api.state.snivRequests.find((item) => item.id === id);
  if (!request || (request.sailorId !== api.sailor.id && request.supervisorId !== api.sailor.id)) {
    return <Screen><Alert variant="error" title="Not authorized">You cannot open this request.</Alert></Screen>;
  }
  const owner = request.sailorId === api.sailor.id;
  const editable = owner && ['DRAFT', 'RETURNED', 'APPROVED'].includes(request.status);
  return (
    <Screen>
      <BackLink to={owner ? '/requests' : '/team'}>{owner ? 'Snivel Log' : 'Team'}</BackLink>
      <div className="flex items-start justify-between gap-3">
        <h1>{SNIV_CATEGORY_LABEL[request.category]}</h1>
        <StatusBadge tone={request.status === 'APPROVED' || request.status === 'COMPLETED' ? 'success' : request.status === 'DENIED' ? 'danger' : 'warning'}>
          {SNIV_STATUS_LABEL[request.status]}
        </StatusBadge>
      </div>
      <p className="font-semibold">{formatDateLong(request.date, api.state.command.timezone)}</p>
      <p>{formatMilitary(request.startTime)}–{formatMilitary(request.endTime)}</p>
      <p>Total requested time: {formatDuration(request.durationMinutes)}</p>
      <p>{SYNC_LABEL[request.syncState]}</p>
      {request.syncState === 'QUEUED_FOR_SUBMISSION' ? <Alert variant="warning" title="Not received">Your supervisor has not received this request.</Alert> : null}
      {request.remarks ? <p>{request.remarks}</p> : null}
      {request.status === 'APPROVED' ? <Alert variant="info">This approval does not complete daily muster.</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      <section className="space-y-2">
        <h2>Approval history</h2>
        <ol className="space-y-2">
          {request.approvals.map((event) => (
            <li key={event.id} className="border-l-4 border-border pl-3">
              <p className="font-semibold">{event.action.replaceAll('_', ' ').toLowerCase()}</p>
              <p className="text-muted-foreground">{formatTimestamp(event.at, api.state.command.timezone)} · {SNIV_STATUS_LABEL[event.newStatus]}</p>
              {event.note ? <p>{event.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>
      {owner && request.status === 'RETURNED' ? (
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          const result = api.submitSniv(toInput(request, note));
          if (!result.ok) setError(result.error);
        }}>
          <Label htmlFor="more-info">Additional information</Label>
          <TextArea id="more-info" value={note} onChange={(event) => setNote(event.target.value)} />
          <Button type="submit" size="lg">Send update</Button>
        </form>
      ) : null}
      <div className="flex flex-col gap-2">
        {editable ? <Link to={`/requests/${request.id}/edit`} className="inline-flex h-12 items-center justify-center rounded-md border border-border font-semibold">Edit request</Link> : null}
        {owner && ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RETURNED'].includes(request.status) ? (
          <Button variant="outline" onClick={() => {
            const result = api.cancelSniv(request.id);
            if (!result.ok) setError(result.error);
          }}>Cancel request</Button>
        ) : null}
        <Link to={`/audit/SnivRequest/${request.id}`} className="inline-flex h-11 items-center font-semibold text-info">View audit history</Link>
      </div>
    </Screen>
  );
}

function toInput(request: SnivRequest, remarks: string): SnivInput {
  return {
    requestId: request.id,
    category: request.category,
    date: request.date,
    endDate: request.endDate,
    startTime: request.startTime,
    endTime: request.endTime,
    remarks: remarks || request.remarks,
  };
}
