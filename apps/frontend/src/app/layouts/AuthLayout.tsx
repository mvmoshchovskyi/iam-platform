import { ShieldCheck } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { ThemeToggle } from '@/shared/components/ThemeToggle';

/** Centered card layout for sign-in / sign-up flows. */
export function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="flex items-center justify-between p-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-6 text-primary" />
          IAM Platform
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
