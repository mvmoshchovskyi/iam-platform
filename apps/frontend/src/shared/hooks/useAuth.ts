import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '@/shared/stores/auth.store';

/** Current authentication state (user, in-memory access token, loading flag). */
export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      user: s.user,
      accessToken: s.accessToken,
      isAuthenticated: s.isAuthenticated,
      isLoading: s.isLoading,
    })),
  );
}
