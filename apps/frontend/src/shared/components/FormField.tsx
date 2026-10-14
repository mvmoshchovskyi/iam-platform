import type { ReactNode } from 'react';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/lib/utils';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  labelAction?: ReactNode;
}

/** Label + control + description/error, wired for screen readers via aria ids. */
export function FormField({
  id,
  label,
  error,
  description,
  children,
  className,
  labelAction,
}: FormFieldProps) {
  return (
    <div className={cn('grid gap-2', className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children}
      {description && !error && (
        <p id={`${id}-description`} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
