import { Link } from 'react-router-dom';

export function EmergencyAlertBanner({ summary }: { summary: string }) {
  return (
    <div className="mx-4 mt-4 rounded-md border border-warning border-l-8 bg-muted p-4">
      <p className="text-base font-semibold">Family Accountability Required</p>
      <p className="mt-1 text-base">{summary}</p>
      <Link
        to="/family/account"
        className="mt-3 inline-flex h-12 items-center justify-center rounded-md bg-primary px-4 font-semibold text-primary-foreground"
      >
        Account for Family
      </Link>
    </div>
  );
}
