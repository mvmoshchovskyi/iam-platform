import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildUser } from '@/test/fixtures';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';

describe('useAuth', () => {
  it('reflects the auth store and reacts to session changes', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current).toMatchObject({ user: null, accessToken: null, isAuthenticated: false });

    const user = buildUser();
    act(() => useAuthStore.getState().setSession('token-1', user));
    expect(result.current).toMatchObject({ user, accessToken: 'token-1', isAuthenticated: true });

    act(() => useAuthStore.getState().clear());
    expect(result.current).toMatchObject({ user: null, accessToken: null, isAuthenticated: false });
  });

  it('never persists the access token to web storage', () => {
    act(() => useAuthStore.getState().setSession('secret-token', buildUser()));
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('secret-token');
  });
});

describe('usePermissions', () => {
  it('checks roles (any) and permissions (all)', () => {
    act(() =>
      useAuthStore
        .getState()
        .setSession(
          't',
          buildUser({ roles: ['USER', 'ADMIN'], permissions: ['users:read', 'audit:read'] }),
        ),
    );
    const { result } = renderHook(() => usePermissions());

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.hasRole('SUPER_ADMIN', 'ADMIN')).toBe(true);
    expect(result.current.hasRole('SUPER_ADMIN')).toBe(false);
    expect(result.current.hasPermission('users:read', 'audit:read')).toBe(true);
    expect(result.current.hasPermission('users:read', 'roles:write')).toBe(false);
  });

  it('denies everything when signed out', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.hasPermission('users:read')).toBe(false);
  });
});
