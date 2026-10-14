import { delay, http as mswHttp, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authResponse, buildUser, problem } from '@/test/fixtures';
import { server } from '@/test/server';
import { useAuthStore } from '@/shared/stores/auth.store';
import { http, queryClient } from './index';
import { onSessionExpired } from './session-events';

/** Simulates the API: only `validToken` is accepted on protected routes. */
const protectedHandler = (path: string, validToken: string, body: object = { ok: true }) =>
  mswHttp.get(`/api${path}`, ({ request }) =>
    request.headers.get('authorization') === `Bearer ${validToken}`
      ? HttpResponse.json(body)
      : HttpResponse.json(problem(401, 'INVALID_ACCESS_TOKEN'), { status: 401 }),
  );

describe('http interceptors', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession('expired-token', buildUser());
  });

  it('attaches the in-memory access token as a Bearer header', async () => {
    useAuthStore.getState().setSession('valid-token', buildUser());
    server.use(protectedHandler('/users/me', 'valid-token'));
    await expect(http.get('/users/me')).resolves.toMatchObject({ status: 200 });
  });

  it('refreshes an expired token and retries the original request once', async () => {
    let refreshCalls = 0;
    server.use(
      protectedHandler('/users/me', 'fresh-token', { id: 'user-1' }),
      mswHttp.post('/api/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json(authResponse('fresh-token'));
      }),
    );

    const res = await http.get('/users/me');

    expect(res.data).toEqual({ id: 'user-1' });
    expect(refreshCalls).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
  });

  it('makes concurrent 401 responses share a single refresh request', async () => {
    let refreshCalls = 0;
    server.use(
      protectedHandler('/sessions', 'fresh-token', []),
      protectedHandler('/users/me', 'fresh-token', { id: 'user-1' }),
      protectedHandler('/admin/users', 'fresh-token', { items: [] }),
      mswHttp.post('/api/auth/refresh', async () => {
        refreshCalls += 1;
        await delay(50);
        return HttpResponse.json(authResponse('fresh-token'));
      }),
    );

    const responses = await Promise.all([
      http.get('/sessions'),
      http.get('/users/me'),
      http.get('/admin/users'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200]);
  });

  it('logs out and redirects when the refresh fails', async () => {
    const redirect = vi.fn();
    onSessionExpired(redirect);
    queryClient.setQueryData(['sessions'], [{ id: 'cached' }]);
    server.use(
      protectedHandler('/users/me', 'never-valid'),
      mswHttp.post('/api/auth/refresh', () =>
        HttpResponse.json(problem(401, 'INVALID_REFRESH_TOKEN'), { status: 401 }),
      ),
    );

    await expect(http.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } });

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    });
    expect(queryClient.getQueryData(['sessions'])).toBeUndefined();
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it('expires the session when the retried request is still unauthorized', async () => {
    const redirect = vi.fn();
    onSessionExpired(redirect);
    let meCalls = 0;
    server.use(
      mswHttp.get('/api/users/me', () => {
        meCalls += 1;
        return HttpResponse.json(problem(401, 'SESSION_REVOKED'), { status: 401 });
      }),
      mswHttp.post('/api/auth/refresh', () => HttpResponse.json(authResponse('fresh-token'))),
    );

    await expect(http.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } });

    expect(meCalls).toBe(2); // original + exactly one retry, no loop
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it.each(['/auth/login', '/auth/register', '/auth/2fa/verify', '/auth/logout'])(
    'does not try to refresh on 401 from %s',
    async (path) => {
      const refresh = vi.fn();
      server.use(
        mswHttp.post(`/api${path}`, () =>
          HttpResponse.json(problem(401, 'INVALID_CREDENTIALS'), { status: 401 }),
        ),
        mswHttp.post('/api/auth/refresh', () => {
          refresh();
          return HttpResponse.json(authResponse('x'));
        }),
      );

      await expect(http.post(path, {})).rejects.toMatchObject({ response: { status: 401 } });
      expect(refresh).not.toHaveBeenCalled();
    },
  );

  it('does not refresh on non-401 errors', async () => {
    const refresh = vi.fn();
    server.use(
      mswHttp.get('/api/admin/users', () =>
        HttpResponse.json(problem(403, 'FORBIDDEN_ROLE'), { status: 403 }),
      ),
      mswHttp.post('/api/auth/refresh', () => {
        refresh();
        return HttpResponse.json(authResponse('x'));
      }),
    );
    await expect(http.get('/admin/users')).rejects.toMatchObject({ response: { status: 403 } });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('adds the CSRF header to logout requests', async () => {
    document.cookie = 'csrf_token=csrf-xyz; path=/';
    let header: string | null = null;
    server.use(
      mswHttp.post('/api/auth/logout', ({ request }) => {
        header = request.headers.get('x-csrf-token');
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await http.post('/auth/logout');
    expect(header).toBe('csrf-xyz');
  });
});
