import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { queryClient } from '@/shared/api/query-client';
import { onSessionExpired } from '@/shared/api/session-events';
import { useAuthStore } from '@/shared/stores/auth.store';
import { server } from './server';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

// The store starts with isLoading=true (pending silent refresh); every test starts signed out
beforeEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
  });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  queryClient.clear();
  onSessionExpired(null);
  document.cookie.split('; ').forEach((c) => {
    document.cookie = `${c.split('=')[0]}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
});

afterAll(() => server.close());

// jsdom lacks matchMedia (used by the theme store)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});
