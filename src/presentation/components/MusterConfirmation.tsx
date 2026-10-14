import { CircleCheck, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SYNC_LABEL } from '../../domain/labels';
import type { SyncState } from '../../domain/types';

export function MusterConfirmation({
  queued,
  verified = false,
  detail,
  syncState,
}: {
  queued: boolean;
  verified?: boolean;
  detail: string;
  syncState: SyncState;
}) {
  const Icon = queued ? Smartphone : CircleCheck;
  const title = queued ? 'Saved on this device.' : verified ? 'Muster Confirmed.' : "You're checked in.";
  return (
    <div className="mnp-check-in space-y-4 py-6 text-center" role="status">
      <Icon className="mx-auto size-16 text-success" aria-hidden />
      <h1>{title}</h1>
      <p>{detail}</p>
      <p className="font-semibold">{SYNC_LABEL[syncState]}</p>
      <div className="flex flex-col gap-2">
        <Link to="/accountability" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 font-semibold text-primary-foreground">
          Back to Accountability
        </Link>
        <Link to="/muster/history" className="inline-flex h-12 items-center justify-center rounded-md border border-border px-4 font-semibold">
          View History
        </Link>
      </div>
    </div>
  );
}
