import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAccountability } from '../../app/state/AccountabilityProvider';
import { supervisorQueue } from '../../domain/viewModels';
import { greeting, formatDateShort, todayInZone } from '../../domain/time';
import { displayName } from '../../domain/labels';
import { activityItems, familyCardModel, musterCardModel, snivCardModel, upcomingAbsences } from '../../domain/viewModels';
import { ActivityTimeline } from '../components/ActivityTimeline';
import { FamilyStatusCard } from '../components/FamilyStatusCard';
import { MusterStatusCard } from '../components/MusterStatusCard';
import { Screen } from '../components/Screen';

export function DashboardPage() {
  const { state, sailor, settings } = useAccountability();
  if (!sailor) return null;
  const now = new Date();
  const today = todayInZone(state.command.timezone, now);
  const muster = musterCardModel(state, sailor, now, settings.forceDutyDay);
  const family = familyCardModel(state, sailor);
  const sniv = snivCardModel(state, sailor, today);
  const activity = activityItems(state, sailor.id, state.command.timezone);
  const upcoming = upcomingAbsences(state, sailor.id, today);
  const queue = supervisorQueue(state, sailor);
  const notes = state.notifications.filter((item) => item.recipientId === sailor.id).slice(0, 2);

  return (
    <Screen>
      <p className="text-muted-foreground">{formatDateShort(today, state.command.timezone)}</p>
      <h1>{greeting(now, state.command.timezone)}. Ready to check in?</h1>
      <p>{displayName(sailor)}</p>
      <p className="text-muted-foreground">{state.command.name}</p>
      <MusterStatusCard model={muster} />
      <FamilyStatusCard count={family.count} statusLine={family.statusLine} showAccount={family.showAccount} />
      <Card>
        <CardHeader><CardTitle>Snivel Log</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p>{sniv.next ? `Next · ${sniv.next.label}, ${sniv.next.when}` : 'No upcoming sniv.'}</p>
          <p>{sniv.pending} pending {sniv.pending === 1 ? 'request' : 'requests'}</p>
          {sniv.returned > 0 ? <p>Your supervisor asked for more information on {sniv.returned} request.</p> : null}
          <div className="flex flex-col gap-2">
            <Link to="/requests/new" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 font-semibold text-primary-foreground">
              Request Time Away
            </Link>
            <Link to="/requests" className="inline-flex h-12 items-center justify-center rounded-md border border-border px-4 font-semibold">
              My Requests
            </Link>
          </div>
        </CardContent>
      </Card>
      {queue.length > 0 ? (
        <Card>
          <CardContent>
            <p className="font-semibold">{queue.length} time-away {queue.length === 1 ? 'request is' : 'requests are'} waiting on you.</p>
            <Link to="/team" className="inline-flex h-11 items-center font-semibold text-info">Review on Team</Link>
          </CardContent>
        </Card>
      ) : null}
      <section className="space-y-2">
        <h2>Recent activity</h2>
        <ActivityTimeline items={activity} />
      </section>
      <section className="space-y-2">
        <h2>Upcoming approved absences</h2>
        {upcoming.length === 0 ? <p className="text-muted-foreground">None scheduled.</p> : (
          <ul className="space-y-2">
            {upcoming.map((item) => (
              <li key={item.id}>
                <Link to={`/requests/${item.id}`} className="block rounded-lg border border-border p-3">
                  <span className="font-semibold">{item.title}</span>
                  <span className="mt-1 block text-muted-foreground">{item.when}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-2">
        <h2>Notifications</h2>
        {notes.length === 0 ? <p className="text-muted-foreground">No alerts.</p> : notes.map((item) => (
          <Link key={item.id} to="/notifications" className="block rounded-lg border border-border p-3">
            <span className="font-semibold">{item.title}</span>
            <span className="mt-1 block">{item.body}</span>
          </Link>
        ))}
      </section>
    </Screen>
  );
}
