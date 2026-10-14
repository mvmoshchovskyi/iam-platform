import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '@/shared/hooks/useAuth';
import { FullPageSpinner } from './LoadingSpinner';

/** Keeps signed-in users away from /login, /register… (sends them to where they came from). */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  if (isLoading) return <FullPageSpinner />;
  if (isAuthenticated) return <Navigate to={from ?? '/dashboard'} replace />;
  return children;
}
