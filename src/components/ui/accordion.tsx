import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Accordion({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const buttonId = useId();
  return (
    <div className={cn('rounded-md border border-border', className)}>
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left text-base font-semibold"
          onClick={() => setOpen((value) => !value)}
        >
          {title}
          <ChevronDown className={cn('size-5 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </h3>
      {open ? (
        <div id={panelId} role="region" aria-labelledby={buttonId} className="border-t border-border px-4 py-3 text-base">
          {children}
        </div>
      ) : null}
    </div>
  );
}
