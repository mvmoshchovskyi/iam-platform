import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { http as mswHttp, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { authResponse, buildUser, problem } from '@/test/fixtures';
import { server } from '@/test/server';
import { http, queryClient } from '@/shared/api';
import { onSessionExpired } from '@/shared/api/session-events';
import { PrivateRoute } from '@/shared/components/PrivateRoute';
import { useAuthStore } from '@/shared/stores/auth.store';

function ProfileProbe() {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => http.get('/users/me').then((r) => r.data as { email: string }),
  });
  return <p>{me.data ? `hello ${me.data.email}` : 'loading profile'}</p>;
}

const setup = () => {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <p>sign in page</p> },
      {
        path: '/profile',
        element: (
          <PrivateRoute>
            <ProfileProbe />
          </PrivateRoute>
        ),
      },
    ],
    { initialEntries: ['/profile'] },
  );
  onSessionExpired(() => void router.navigate('/login'));
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

describe('protected page with an expired access token', () => {
  it('transparently refreshes and renders the data', async () => {
    useAuthStore.getState().setSession('expired', buildUser());
    server.use(
      mswHttp.get('/api/users/me', ({ request }) =>
        request.headers.get('authorization') === 'Bearer fresh'
          ? HttpResponse.json({ email: 'jane@example.com' })
          : HttpResponse.json(problem(401, 'INVALID_ACCESS_TOKEN'), { status: 401 }),
      ),
      mswHttp.post('/api/auth/refresh', () => HttpResponse.json(authResponse('fresh'))),
    );

    setup();

    expect(await screen.findByText('hello jane@example.com')).toBeInTheDocument();
  });

  it('redirects to sign-in and clears the session when the refresh token is rejected', async () => {
    useAuthStore.getState().setSession('expired', buildUser());
    server.use(
      mswHttp.get('/api/users/me', () =>
        HttpResponse.json(problem(401, 'INVALID_ACCESS_TOKEN'), { status: 401 }),
      ),
      mswHttp.post('/api/auth/refresh', () =>
        HttpResponse.json(problem(401, 'REFRESH_TOKEN_REUSED'), { status: 401 }),
      ),
    );

    const router = setup();

    expect(await screen.findByText('sign in page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(useAuthStore.getState()).toMatchObject({ isAuthenticated: false, accessToken: null });
  });
});
