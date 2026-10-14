import { Bell } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAccountability } from '../../app/state/AccountabilityProvider';
import { activeEmergency, rosterScope } from '../../domain/accountability';
import { displayName } from '../../domain/labels';
import { SAILOR_ID, SUPERVISOR_ID } from '../../data/seed';
import { cn } from '../../lib/cn';
import { Alert } from '../../components/ui/alert';
import { BottomNavigation } from './BottomNavigation';
import { EmergencyAlertBanner } from './EmergencyAlertBanner';

export function AppFrame({ children }: { children: ReactNode }) {
  const api = useAccountability();
  const navigate = useNavigate();
  const unread = api.state.notifications.filter((item) => item.recipientId === api.sailor?.id && !item.readAt).length;
  const event = activeEmergency(api.state);
  const conflicts = api.state.outbox.filter((item) => item.sailorId === api.sailor?.id && item.status === 'CONFLICT');
  const supervisor = api.sailor ? rosterScope(api.sailor) !== 'NONE' : false;

  function switchRole(sailorId: string, to: string) {
    if (api.sailor?.id === sailorId) {
      navigate(to);
      return;
    }
    api.signIn(sailorId);
    navigate(to);
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        {api.sailor ? (
          <header className="sticky top-0 z-20 border-b border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Accountability</p>
                <p className="text-sm text-muted-foreground">{displayName(api.sailor)}</p>
              </div>
              <button type="button" className="inline-flex h-11 w-11 items-center justify-center" aria-label={`Notifications, ${unread} unread`} onClick={() => navigate('/notifications')}>
                <span className="relative">
                  <Bell className="size-5" aria-hidden />
                  {unread > 0 ? (
                    <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground">{unread}</span>
                  ) : null}
                </span>
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 rounded-md border border-border p-1" role="group" aria-label="Role">
              <button
                type="button"
                aria-pressed={api.sailor.id === SAILOR_ID}
                className={cn(
                  'h-11 rounded-sm font-semibold',
                  api.sailor.id === SAILOR_ID ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
                onClick={() => switchRole(SAILOR_ID, '/accountability')}
              >
                Sailor
              </button>
              <button
                type="button"
                aria-pressed={api.sailor.id === SUPERVISOR_ID}
                className={cn(
                  'h-11 rounded-sm font-semibold',
                  api.sailor.id === SUPERVISOR_ID ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
                onClick={() => switchRole(SUPERVISOR_ID, '/team')}
              >
                Supervisor
              </button>
            </div>
          </header>
        ) : null}
        <div className="flex-1">
          {api.settings.connectivity === 'offline' ? (
            <div className="px-4 pt-4">
              <Alert variant="warning" title="No connectivity">
                Submissions stay on this device. Your command has not received them.
              </Alert>
            </div>
          ) : null}
          {conflicts.length > 0 ? (
            <div className="px-4 pt-4">
              <Alert variant="error" title="Sync conflict">
                A newer command record exists. Your queued update was not applied.
              </Alert>
            </div>
          ) : null}
          {event ? (
            <EmergencyAlertBanner summary={`${event.name}. ${event.summary} Please report the status of yourself and your family.`} />
          ) : null}
          {api.flash ? (
            <div className="px-4 pt-4">
              <Alert variant="info" title="Update">
                <p>{api.flash}</p>
                <button type="button" className="mt-2 font-semibold text-info" onClick={api.clearFlash}>Dismiss</button>
              </Alert>
            </div>
          ) : null}
          <main id="main">{children}</main>
        </div>
        <BottomNavigation unread={unread} supervisor={supervisor} />
      </div>
    </div>
  );
}

export function AuthenticatedLayout() {
  const { sailor } = useAccountability();
  if (!sailor) return <Navigate to="/accountability" replace />;
  return (
    <AppFrame>
      <Outlet />
    </AppFrame>
  );
}
