import { type ReactNode, useEffect } from 'react';
import { refreshAccessToken } from '@/shared/api';
import { hasSessionCookie } from '@/shared/api/csrf';
import { FullPageSpinner } from '@/shared/components/LoadingSpinner';
import { useAuthStore } from '@/shared/stores/auth.store';

/**
 * On app load, restores the session from the HttpOnly refresh cookie (silent refresh).
 * The access token then lives only in memory for this tab's lifetime.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    const { clear, setLoading } = useAuthStore.getState();
    if (!hasSessionCookie()) {
      setLoading(false);
      return;
    }
    // Single-flight: React StrictMode's double effect still results in one request
    refreshAccessToken()
      .catch(() => clear())
      .finally(() => setLoading(false));
  }, []);

  return isLoading ? <FullPageSpinner /> : children;
}
