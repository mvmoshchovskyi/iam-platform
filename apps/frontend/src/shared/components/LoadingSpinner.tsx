import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export function LoadingSpinner({
  className,
  label = 'Loading',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <Loader2 className={cn('size-5 animate-spin text-muted-foreground', className)} />
    </span>
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <LoadingSpinner className="size-8" />
    </div>
  );
}
