import { delay, http as mswHttp, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { authResponse, buildUser } from '@/test/fixtures';
import { server } from '@/test/server';
import { useAuthStore } from '@/shared/stores/auth.store';
import { refreshAccessToken } from './refresh';

describe('refreshAccessToken (single-flight)', () => {
  it('shares one in-flight refresh between concurrent callers', async () => {
    let calls = 0;
    server.use(
      mswHttp.post('/api/auth/refresh', async () => {
        calls += 1;
        await delay(30);
        return HttpResponse.json(authResponse(`token-${calls}`));
      }),
    );

    const results = await Promise.all([
      refreshAccessToken(),
      refreshAccessToken(),
      refreshAccessToken(),
    ]);

    expect(calls).toBe(1);
    expect(results).toEqual(['token-1', 'token-1', 'token-1']);
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'token-1',
      isAuthenticated: true,
    });
  });

  it('starts a new refresh once the previous one settled', async () => {
    let calls = 0;
    server.use(
      mswHttp.post('/api/auth/refresh', () => HttpResponse.json(authResponse(`token-${++calls}`))),
    );

    await refreshAccessToken();
    await expect(refreshAccessToken()).resolves.toBe('token-2');
    expect(calls).toBe(2);
  });

  it('sends the CSRF cookie value as X-CSRF-Token (double submit)', async () => {
    document.cookie = 'csrf_token=csrf-abc; path=/';
    let header: string | null = null;
    server.use(
      mswHttp.post('/api/auth/refresh', ({ request }) => {
        header = request.headers.get('x-csrf-token');
        return HttpResponse.json(authResponse('t', buildUser()));
      }),
    );

    await refreshAccessToken();
    expect(header).toBe('csrf-abc');
  });

  it('propagates refresh failures to every waiting caller', async () => {
    server.use(mswHttp.post('/api/auth/refresh', () => new HttpResponse(null, { status: 401 })));
    const results = await Promise.allSettled([refreshAccessToken(), refreshAccessToken()]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
  });
});
