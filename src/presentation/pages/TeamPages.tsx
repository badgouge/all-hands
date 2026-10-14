import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { Input, TextArea } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAccountability } from '../../app/state/AccountabilityProvider';
import { rosterScope } from '../../domain/accountability';
import { MUSTER_STATUS_LABEL } from '../../domain/labels';
import { formatTimestamp, todayInZone } from '../../domain/time';
import type { MusterStatus } from '../../domain/types';
import { queueItem, rosterRows } from '../../domain/viewModels';
import { ApprovalQueue } from '../components/ApprovalQueue';
import { CommandMusterRoster } from '../components/CommandMusterRoster';
import { BackLink, Screen } from '../components/Screen';

export function TeamPage() {
  const api = useAccountability();
  const [error, setError] = useState<string | null>(null);
  if (!api.sailor) return null;
  if (rosterScope(api.sailor) === 'NONE') return <Screen><Alert variant="error" title="Not authorized">Your role does not include a team view.</Alert></Screen>;
  const now = new Date();
  const rows = rosterRows(api.state, api.sailor, now, api.settings.forceDutyDay);
  const pending = api.state.snivRequests
    .filter((request) => request.supervisorId === api.sailor?.id && request.status === 'PENDING_APPROVAL' && request.syncState === 'RECEIVED_BY_SERVICE')
    .map((request) => queueItem(api.state, request));

  return (
    <Screen>
      <h1>Team</h1>
      <p className="text-muted-foreground">Confirm muster and decide snivel requests for your Sailors.</p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <section className="space-y-3">
        <h2>Muster</h2>
        {rows.length === 0 ? <p className="text-muted-foreground">No Sailors are assigned to you.</p> : rows.map((row) => (
          <article key={row.sailorId} className="space-y-3 rounded-lg border border-border p-4">
            <div>
              <p className="font-semibold">{row.name}</p>
              <p className="text-muted-foreground">{row.division}</p>
            </div>
            <p>{row.statusLabel}</p>
            <p className="text-muted-foreground">
              {row.verificationLabel}
              {row.reportedAt ? ` · ${row.reportedAt}` : ''}
            </p>
            {row.canVerify && row.recordId && row.verificationLabel !== 'Verified' ? (
              <Button size="lg" className="w-full" onClick={() => {
                const result = api.verifyMuster(row.recordId!);
                setError(result.ok ? null : result.error);
              }}>
                Confirm muster
              </Button>
            ) : row.verificationLabel === 'Verified' ? (
              <p>Muster confirmed.</p>
            ) : null}
            <Link to={`/team/roster/${row.sailorId}`} className="inline-flex min-h-11 items-center font-semibold text-info">Muster details</Link>
          </article>
        ))}
      </section>
      <section className="space-y-3">
        <h2>Snivel requests</h2>
        <ApprovalQueue
          items={pending}
          onApprove={(id) => {
            const result = api.approveSniv(id);
            setError(result.ok ? null : result.error);
          }}
          onDeny={(id, reason) => {
            const result = api.denySniv(id, reason);
            setError(result.ok ? null : result.error);
          }}
          onReturn={(id, reason) => {
            const result = api.returnSniv(id, reason);
            setError(result.ok ? null : result.error);
          }}
        />
      </section>
    </Screen>
  );
}

export function RosterPage() {
  const api = useAccountability();
  const [query, setQuery] = useState('');
  if (!api.sailor) return null;
  if (rosterScope(api.sailor) === 'NONE') return <Screen><Alert variant="error" title="Not authorized">You cannot view the roster.</Alert></Screen>;
  const rows = rosterRows(api.state, api.sailor, new Date(), api.settings.forceDutyDay).filter((row) =>
    row.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Screen>
      <BackLink to="/team">Team</BackLink>
      <h1>Muster roster</h1>
      <div className="space-y-1">
        <Label htmlFor="roster-search">Search</Label>
        <Input id="roster-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name" />
      </div>
      <CommandMusterRoster rows={rows} />
    </Screen>
  );
}

export function RosterDetailPage() {
  const api = useAccountability();
  const { sailorId } = useParams();
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<MusterStatus>('PRESENT');
  const [error, setError] = useState<string | null>(null);
  if (!api.sailor || !sailorId) return null;
  const allowed = rosterRows(api.state, api.sailor, new Date(), api.settings.forceDutyDay).some((row) => row.sailorId === sailorId);
  if (!allowed) return <Screen><Alert variant="error" title="Not authorized">That Sailor is outside your view.</Alert></Screen>;
  const subject = api.state.sailors.find((item) => item.id === sailorId);
  const today = todayInZone(api.state.command.timezone, new Date());
  const record = api.state.musters.find((item) => item.sailorId === sailorId && item.reportingDate === today);
  const row = rosterRows(api.state, api.sailor, new Date(), api.settings.forceDutyDay).find((item) => item.sailorId === sailorId);
  if (!subject || !row) return null;

  function act(result: { ok: boolean; error?: string }) {
    if (!result.ok) setError(result.error ?? 'The action was not recorded.');
    else setError(null);
  }

  return (
    <Screen>
      <BackLink to="/team">Team</BackLink>
      <h1>{row.name}</h1>
      <p>{row.division}</p>
      <p>{row.statusLabel}</p>
      <p>{row.verificationLabel} · {row.syncLabel}</p>
      {record ? (
        <ol className="space-y-2">
          {record.events.map((event) => (
            <li key={event.id} className="border-l-4 border-border pl-3">
              <p className="font-semibold">{event.type.replaceAll('_', ' ').toLowerCase()} · {MUSTER_STATUS_LABEL[event.status]}</p>
              <p className="text-muted-foreground">{formatTimestamp(event.at, api.state.command.timezone)}{event.note ? ` · ${event.note}` : ''}</p>
            </li>
          ))}
        </ol>
      ) : <p>No muster has been received today.</p>}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {row.canVerify && record ? (
        <div className="space-y-3">
          {record.verification !== 'VERIFIED' ? (
            <Button size="lg" onClick={() => act(api.verifyMuster(record.id))}>Confirm muster</Button>
          ) : (
            <p>This muster is already confirmed.</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="flag-reason">Discrepancy reason</Label>
            <TextArea id="flag-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            <Button variant="outline" onClick={() => act(api.flagMuster(record.id, reason))}>Flag discrepancy</Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="correct-status">Correct status</Label>
            <select id="correct-status" className="h-11 w-full rounded-md border border-input bg-card px-3" value={status} onChange={(event) => setStatus(event.target.value as MusterStatus)}>
              {Object.entries(MUSTER_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <Button variant="secondary" onClick={() => act(api.correctMuster(record.id, status, reason))}>Record correction</Button>
          </div>
        </div>
      ) : null}
      {record ? <Link to={`/audit/MusterRecord/${record.id}`} className="inline-flex h-11 items-center font-semibold text-info">View audit history</Link> : null}
    </Screen>
  );
}

export function ApprovalsPage() {
  const api = useAccountability();
  const [error, setError] = useState<string | null>(null);
  if (!api.sailor) return null;
  if (!api.sailor.roles.includes('SUPERVISOR')) {
    return <Screen><Alert variant="error" title="Not authorized">Only an assigned supervisor can decide requests.</Alert></Screen>;
  }
  const items = api.state.snivRequests
    .filter((request) => request.supervisorId === api.sailor?.id && request.status === 'PENDING_APPROVAL' && request.syncState === 'RECEIVED_BY_SERVICE')
    .map((request) => queueItem(api.state, request));
  return (
    <Screen>
      <BackLink to="/team">Team</BackLink>
      <h1>Approvals</h1>
      {error ? <Alert variant="error">{error}</Alert> : null}
      <ApprovalQueue
        items={items}
        onApprove={(id) => {
          const result = api.approveSniv(id);
          if (!result.ok) setError(result.error);
        }}
        onDeny={(id, reason) => {
          const result = api.denySniv(id, reason);
          if (!result.ok) setError(result.error);
        }}
        onReturn={(id, reason) => {
          const result = api.returnSniv(id, reason);
          if (!result.ok) setError(result.error);
        }}
      />
    </Screen>
  );
}

