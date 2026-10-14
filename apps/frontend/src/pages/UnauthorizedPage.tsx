import { ShieldX } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/shared/components/ui/button';

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <ShieldX className="size-12 text-destructive" />
      <p className="text-5xl font-bold tracking-tight">403</p>
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        You don't have permission to view this page. Ask an administrator if you think this is a
        mistake.
      </p>
      <Button asChild>
        <Link to="/dashboard">Go to dashboard</Link>
      </Button>
    </div>
  );
}
