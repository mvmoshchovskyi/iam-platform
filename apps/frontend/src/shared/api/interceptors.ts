import { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/shared/stores/auth.store';
import { getCsrfToken } from './csrf';
import { queryClient } from './query-client';
import { refreshAccessToken } from './refresh';
import { notifySessionExpired } from './session-events';

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Endpoints whose 401 means "bad credentials/session", not "access token expired". */
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/2fa/verify',
];
/** Endpoints authenticated by the refresh cookie need the double-submit CSRF header. */
const CSRF_PATHS = ['/auth/refresh', '/auth/logout'];

const matches = (url: string | undefined, paths: string[]) =>
  !!url && paths.some((p) => url.endsWith(p));

/** Clears every trace of the user client-side and lets the router redirect to /login. */
export function expireSession(): void {
  useAuthStore.getState().clear();
  queryClient.clear();
  notifySessionExpired();
}

export function setupInterceptors(client: AxiosInstance): void {
  client.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
    if (matches(config.url, CSRF_PATHS)) {
      const csrf = getCsrfToken();
      if (csrf) config.headers['X-CSRF-Token'] = csrf;
    }
    return config;
  });

  client.interceptors.response.use(undefined, async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    if (error.response?.status !== 401 || !original || matches(original.url, NO_REFRESH_PATHS)) {
      throw error;
    }

    // Already retried with a fresh token and still unauthorized → the session is gone
    if (original._retry) {
      expireSession();
      throw error;
    }

    original._retry = true;
    let token: string;
    try {
      token = await refreshAccessToken();
    } catch {
      expireSession();
      throw error;
    }
    original.headers.Authorization = `Bearer ${token}`;
    return client(original);
  });
}
