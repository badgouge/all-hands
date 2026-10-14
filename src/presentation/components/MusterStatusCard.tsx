import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import type { MusterCardModel } from '../../domain/viewModels';
import { musterTone, StatusBadge } from './StatusBadge';

export function MusterStatusCard({ model }: { model: MusterCardModel }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>Daily Muster</CardTitle>
        <StatusBadge tone={musterTone(model.state)}>{model.label}</StatusBadge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p>{model.detail}</p>
        {model.deadline ? <p className="text-muted-foreground">{model.deadline}</p> : null}
        {model.lastReported ? <p className="text-muted-foreground">Last muster {model.lastReported}</p> : null}
        {model.approvedAbsenceNote ? (
          <p className="rounded-md bg-muted px-3 py-2">{model.approvedAbsenceNote}. This does not complete muster.</p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Link
            to="/muster"
            className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 font-semibold text-primary-foreground"
          >
            {model.canSubmit ? model.actionLabel : 'View muster'}
          </Link>
          <Link
            to="/muster/history"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border px-4 font-semibold"
          >
            View History
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
