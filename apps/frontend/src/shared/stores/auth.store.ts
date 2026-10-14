import { create } from 'zustand';
import type { User } from '@/shared/types/api';

interface AuthState {
  user: User | null;
  /** Kept in memory only — never persisted to localStorage/sessionStorage. */
  accessToken: string | null;
  isAuthenticated: boolean;
  /** True until the initial silent refresh has completed. */
  isLoading: boolean;
  setSession: (accessToken: string, user: User) => void;
  setUser: (user: User) => void;
  setLoading: (isLoading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  setSession: (accessToken, user) => set({ accessToken, user, isAuthenticated: true }),
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ user: null, accessToken: null, isAuthenticated: false }),
}));
