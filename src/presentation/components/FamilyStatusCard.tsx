import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export function FamilyStatusCard({
  count,
  statusLine,
  showAccount,
}: {
  count: number;
  statusLine: string;
  showAccount: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Family Accountability</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="font-semibold">{count} registered {count === 1 ? 'dependent' : 'dependents'}</p>
        <p>{statusLine}</p>
        <div className="flex flex-col gap-2">
          <Link to="/family" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 font-semibold text-primary-foreground">
            My Family
          </Link>
          {showAccount ? (
            <Link to="/family/account" className="inline-flex h-12 items-center justify-center rounded-md border border-border px-4 font-semibold">
              Account for Family
            </Link>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
