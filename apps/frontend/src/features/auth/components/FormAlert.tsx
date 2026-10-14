import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

const STYLES = {
  error: {
    icon: AlertCircle,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400',
  },
  info: { icon: Info, className: 'border-primary/20 bg-primary/5 text-foreground' },
};

export function FormAlert({
  variant = 'error',
  children,
}: {
  variant?: keyof typeof STYLES;
  children: ReactNode;
}) {
  const { icon: Icon, className } = STYLES[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2 rounded-md border p-3 text-sm', className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}
