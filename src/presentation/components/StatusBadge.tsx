import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { MusterCardModel } from '../../domain/viewModels';

const tones = {
  neutral: 'bg-muted text-foreground',
  info: 'bg-info text-info-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  danger: 'bg-destructive text-destructive-foreground',
};

export function StatusBadge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-sm font-semibold', tones[tone])}>
      {children}
    </span>
  );
}

export function musterTone(state: MusterCardModel['state']): keyof typeof tones {
  if (state === 'MUSTERED' || state === 'EXCUSED') return 'success';
  if (state === 'AWAITING_VERIFICATION') return 'info';
  if (state === 'ACTION_REQUIRED' || state === 'WINDOW_CLOSED') return 'danger';
  if (state === 'SAVED_ON_DEVICE' || state === 'NOT_MUSTERED') return 'warning';
  return 'neutral';
}
