import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function Screen({ children }: { children: ReactNode }) {
  return <div className="space-y-4 px-4 py-4">{children}</div>;
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1 font-semibold text-info">
      <ChevronLeft className="size-5 shrink-0" aria-hidden />
      {children}
    </Link>
  );
}
