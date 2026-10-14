import { Link } from 'react-router-dom';
import type { RosterRowModel } from '../../domain/viewModels';
import { StatusBadge } from './StatusBadge';

export function CommandMusterRoster({ rows }: { rows: RosterRowModel[] }) {
  if (rows.length === 0) return <p className="text-muted-foreground">No personnel are in your authorized view.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.sailorId}>
          <Link to={`/team/roster/${row.sailorId}`} className="block rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{row.name}</p>
                <p className="text-muted-foreground">{row.division}</p>
              </div>
              {row.attention ? <StatusBadge tone="warning">Attention</StatusBadge> : null}
            </div>
            <p className="mt-2">{row.statusLabel}</p>
            <p className="text-muted-foreground">
              {row.verificationLabel}
              {row.reportedAt ? ` · ${row.reportedAt}` : ''}
            </p>
            <p className="text-muted-foreground">{row.syncLabel}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
