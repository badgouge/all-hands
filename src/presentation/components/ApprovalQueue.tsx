import { useState } from 'react';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import { TextArea } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { formatDuration } from '../../domain/time';

export interface QueueCard {
  id: string;
  requester: string;
  when: string;
  duration: number;
  category: string;
  remarks: string;
  conflict: boolean;
}

export function ApprovalQueue({
  items,
  onApprove,
  onDeny,
  onReturn,
}: {
  items: QueueCard[];
  onApprove: (id: string) => void;
  onDeny: (id: string, reason: string) => void;
  onReturn: (id: string, reason: string) => void;
}) {
  if (items.length === 0) return <p className="text-muted-foreground">No requests are waiting for you.</p>;
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.id}>
          <QueueItem item={item} onApprove={onApprove} onDeny={onDeny} onReturn={onReturn} />
        </li>
      ))}
    </ul>
  );
}

function QueueItem({
  item,
  onApprove,
  onDeny,
  onReturn,
}: {
  item: QueueCard;
  onApprove: (id: string) => void;
  onDeny: (id: string, reason: string) => void;
  onReturn: (id: string, reason: string) => void;
}) {
  const [mode, setMode] = useState<'deny' | 'return' | null>(null);
  const [reason, setReason] = useState('');
  return (
    <article className="space-y-3 rounded-lg border border-border p-4">
      <h2 className="text-base">{item.requester}</h2>
      <p>{item.when}</p>
      <p>Total requested time: {formatDuration(item.duration)}</p>
      <p>{item.category}</p>
      {item.remarks ? <p className="text-muted-foreground">{item.remarks}</p> : null}
      {item.conflict ? <Alert variant="warning" title="Scheduling overlap">This overlaps another approved absence.</Alert> : null}
      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={() => onApprove(item.id)}>Approve</Button>
        <Button size="lg" variant="outline" onClick={() => setMode('return')}>Return for Information</Button>
        <Button size="lg" variant="destructive" onClick={() => setMode('deny')}>Deny</Button>
      </div>
      {mode ? (
        <div className="space-y-2">
          <Label htmlFor={`${item.id}-reason`}>{mode === 'deny' ? 'Reason for denial' : 'What information do you need?'}</Label>
          <TextArea id={`${item.id}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} />
          <Button
            size="lg"
            variant={mode === 'deny' ? 'destructive' : 'secondary'}
            onClick={() => (mode === 'deny' ? onDeny(item.id, reason) : onReturn(item.id, reason))}
          >
            {mode === 'deny' ? 'Confirm denial' : 'Send back'}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
