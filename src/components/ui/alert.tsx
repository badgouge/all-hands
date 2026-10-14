import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const styles = {
  info: 'border-info bg-muted text-foreground',
  warning: 'border-warning bg-muted text-foreground',
  error: 'border-destructive bg-muted text-foreground',
  success: 'border-success bg-muted text-foreground',
};

const icons = {
  info: Info,
  warning: TriangleAlert,
  error: CircleX,
  success: CircleCheck,
};

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof styles;
  title?: string;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, children, ...props }, ref) => {
    const Icon = icons[variant];
    return (
      <div
        ref={ref}
        role="alert"
        tabIndex={-1}
        className={cn(
          'flex gap-3 rounded-md border border-l-8 p-4 text-base',
          styles[variant],
          className,
        )}
        {...props}
      >
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 space-y-1">
          {title ? <p className="font-semibold">{title}</p> : null}
          <div>{children}</div>
        </div>
      </div>
    );
  },
);
Alert.displayName = 'Alert';
