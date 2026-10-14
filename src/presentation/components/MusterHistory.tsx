import { MUSTER_STATUS_SHORT, SYNC_LABEL } from '../../domain/labels';
import { formatDateShort, formatTimestamp } from '../../domain/time';
import type { MusterPeriod, MusterRecord } from '../../domain/types';

export function MusterHistory({
  periods,
  records,
  timeZone,
}: {
  periods: MusterPeriod[];
  records: MusterRecord[];
  timeZone: string;
}) {
  const ordered = [...periods].sort((a, b) => b.reportingDate.localeCompare(a.reportingDate)).slice(0, 14);
  if (ordered.length === 0) return <p className="text-muted-foreground">No muster periods are on file.</p>;
  return (
    <ol className="space-y-3">
      {ordered.map((period) => {
        const record = records.find((item) => item.periodId === period.id);
        return (
          <li key={period.id} className="rounded-lg border border-border p-4">
            <p className="font-semibold">{formatDateShort(period.reportingDate, timeZone)}</p>
            {!period.required ? (
              <p className="text-muted-foreground">{period.reasonIfNotRequired === 'HOLIDAY' ? 'Holiday — muster not required' : 'Weekend — muster not required'}</p>
            ) : record ? (
              <div className="mt-1 space-y-1">
                <p>{MUSTER_STATUS_SHORT[record.status]}</p>
                <p className="text-muted-foreground">
                  {record.submittedAt ? formatTimestamp(record.submittedAt, timeZone) : 'No time'} · {SYNC_LABEL[record.syncState]}
                </p>
                {record.statusOrigin === 'SYSTEM_DERIVED' ? <p className="text-muted-foreground">System-derived from {record.sourceSystem.replaceAll('_', ' ').toLowerCase()}.</p> : null}
                <ol className="mt-2 space-y-2 border-l-4 border-border pl-3">
                  {record.events.map((event) => (
                    <li key={event.id}>
                      <p className="font-semibold">{event.type.replaceAll('_', ' ').toLowerCase()}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTimestamp(event.at, timeZone)}
                        {event.note ? ` · ${event.note}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="text-muted-foreground">No submission recorded.</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
