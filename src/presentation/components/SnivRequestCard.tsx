import { Link } from 'react-router-dom';
import { SNIV_CATEGORY_LABEL, SNIV_STATUS_LABEL, SYNC_LABEL } from '../../domain/labels';
import { formatDateShort, formatMilitary } from '../../domain/time';
import type { SnivRequest } from '../../domain/types';
import { StatusBadge } from './StatusBadge';

export function SnivRequestCard({ request, timeZone }: { request: SnivRequest; timeZone: string }) {
  const tone =
    request.status === 'APPROVED' || request.status === 'COMPLETED'
      ? 'success'
      : request.status === 'DENIED' || request.status === 'CANCELLED'
        ? 'danger'
        : request.status === 'PENDING_APPROVAL' || request.status === 'RETURNED'
          ? 'warning'
          : 'neutral';
  return (
    <Link to={`/requests/${request.id}`} className="block rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{SNIV_CATEGORY_LABEL[request.category]}</p>
        <StatusBadge tone={tone}>{SNIV_STATUS_LABEL[request.status]}</StatusBadge>
      </div>
      <p className="mt-1">
        {formatDateShort(request.date, timeZone)} {formatMilitary(request.startTime)}–{formatMilitary(request.endTime)}
      </p>
      <p className="text-muted-foreground">{SYNC_LABEL[request.syncState]}</p>
    </Link>
  );
}
