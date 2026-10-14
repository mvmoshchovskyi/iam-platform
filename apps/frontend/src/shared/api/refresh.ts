import axios from 'axios';
import { useAuthStore } from '@/shared/stores/auth.store';
import type { AuthResponse } from '@/shared/types/api';
import { getCsrfToken } from './csrf';
import { API_BASE_URL } from './http';

let refreshPromise: Promise<string> | null = null;

/**
 * Single-flight refresh: concurrent callers (e.g. several requests failing with 401 at once)
 * share one POST /auth/refresh. Uses a bare axios call so it never re-enters the interceptors.
 */
export function refreshAccessToken(): Promise<string> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function performRefresh(): Promise<string> {
  const csrf = getCsrfToken();
  const { data } = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/refresh`, undefined, {
    withCredentials: true,
    headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
  });
  useAuthStore.getState().setSession(data.accessToken, data.user);
  return data.accessToken;
}
