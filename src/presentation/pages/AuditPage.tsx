import { useParams } from 'react-router-dom';
import { Alert } from '../../components/ui/alert';
import { useAccountability } from '../../app/state/AccountabilityProvider';
import { displayName } from '../../domain/labels';
import { auditTrail } from '../../domain/viewModels';
import { BackLink, Screen } from '../components/Screen';

export function AuditPage() {
  const { state, sailor } = useAccountability();
  const { entityType, entityId } = useParams();
  if (!sailor || !entityType || !entityId) return null;
  const events = auditTrail(state, entityType, entityId, state.command.timezone);
  const allowed = events.length === 0 || events.some((event) => event.actorId === sailor.id) || state.audit.some((event) => event.entityId === entityId && (event.actorId === sailor.id || event.onBehalfOfId === sailor.id));
  const inScope = state.audit.some((event) => event.entityId === entityId && (event.onBehalfOfId === sailor.id || event.actorId === sailor.id));
  if (!inScope && sailor.roles.length === 1) {
    return <Screen><Alert variant="error" title="Not authorized">You cannot view this history.</Alert></Screen>;
  }
  return (
    <Screen>
      <BackLink to="/accountability">Accountability</BackLink>
      <h1>Audit history</h1>
      {!allowed || events.length === 0 ? <p className="text-muted-foreground">No audit events are available for this record.</p> : (
        <ol className="space-y-3">
          {events.map((event) => {
            const actor = state.sailors.find((item) => item.id === event.actorId);
            return (
              <li key={event.id} className="rounded-lg border border-border p-4">
                <p className="font-semibold">{event.action}</p>
                <p>{event.at}</p>
                <p className="text-muted-foreground">{actor ? displayName(actor) : event.actorId}</p>
                <p className="text-muted-foreground">{event.previousState ?? 'None'} → {event.newState}</p>
              </li>
            );
          })}
        </ol>
      )}
    </Screen>
  );
}
