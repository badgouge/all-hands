import { cn } from '../../lib/cn';

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-sm font-semibold',
        className,
      )}
    >
      {children}
    </span>
  );
}
