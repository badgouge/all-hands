import type { SnivRequest } from '../../domain/types';
import { SnivRequestCard } from './SnivRequestCard';

export function SnivRequestHistory({
  upcoming,
  pending,
  past,
  timeZone,
}: {
  upcoming: SnivRequest[];
  pending: SnivRequest[];
  past: SnivRequest[];
  timeZone: string;
}) {
  return (
    <div className="space-y-5">
      <Section title="Upcoming" requests={upcoming} timeZone={timeZone} empty="No upcoming approved absences." />
      <Section title="Pending" requests={pending} timeZone={timeZone} empty="No requests are waiting on a decision." />
      <Section title="Past" requests={past} timeZone={timeZone} empty="No past requests." />
    </div>
  );
}

function Section({
  title,
  requests,
  timeZone,
  empty,
}: {
  title: string;
  requests: SnivRequest[];
  timeZone: string;
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h2>{title}</h2>
      {requests.length === 0 ? <p className="text-muted-foreground">{empty}</p> : requests.map((request) => (
        <SnivRequestCard key={request.id} request={request} timeZone={timeZone} />
      ))}
    </section>
  );
}
