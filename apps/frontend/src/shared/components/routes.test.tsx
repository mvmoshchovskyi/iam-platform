import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { buildUser } from '@/test/fixtures';
import { useAuthStore } from '@/shared/stores/auth.store';
import { GuestRoute } from './GuestRoute';
import { PrivateRoute } from './PrivateRoute';

function LoginProbe() {
  const from = (useLocation().state as { from?: { pathname: string } } | null)?.from?.pathname;
  return <p>login page (from: {from ?? 'none'})</p>;
}

const renderAt = (path: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: '/login',
            element: (
              <GuestRoute>
                <LoginProbe />
              </GuestRoute>
            ),
          },
          {
            path: '/dashboard',
            element: (
              <PrivateRoute>
                <p>dashboard</p>
              </PrivateRoute>
            ),
          },
          {
            path: '/profile/sessions',
            element: (
              <PrivateRoute>
                <p>sessions</p>
              </PrivateRoute>
            ),
          },
        ],
        { initialEntries: [path] },
      )}
    />,
  );

describe('PrivateRoute', () => {
  it('redirects unauthenticated users to /login, remembering where they were going', () => {
    renderAt('/profile/sessions');
    expect(screen.getByText('login page (from: /profile/sessions)')).toBeInTheDocument();
  });

  it('renders the page for authenticated users', () => {
    useAuthStore.getState().setSession('t', buildUser());
    renderAt('/dashboard');
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('shows a spinner while the initial silent refresh is running', () => {
    useAuthStore.setState({ isLoading: true });
    renderAt('/dashboard');
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument();
  });
});

describe('GuestRoute', () => {
  it('sends authenticated users away from /login', () => {
    useAuthStore.getState().setSession('t', buildUser());
    renderAt('/login');
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });
});
