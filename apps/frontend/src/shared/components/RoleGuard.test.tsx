import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildUser } from '@/test/fixtures';
import { useAuthStore } from '@/shared/stores/auth.store';
import { RoleGuard } from './RoleGuard';

describe('RoleGuard', () => {
  beforeEach(() => {
    useAuthStore
      .getState()
      .setSession('t', buildUser({ roles: ['USER', 'ADMIN'], permissions: ['users:read'] }));
  });

  it('renders children when the user has one of the roles', () => {
    render(<RoleGuard roles={['ADMIN', 'SUPER_ADMIN']}>admin panel</RoleGuard>);
    expect(screen.getByText('admin panel')).toBeInTheDocument();
  });

  it('renders the fallback when the role is missing', () => {
    render(
      <RoleGuard roles={['SUPER_ADMIN']} fallback={<span>denied</span>}>
        secret
      </RoleGuard>,
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText('denied')).toBeInTheDocument();
  });

  it('requires every listed permission', () => {
    render(
      <>
        <RoleGuard permissions={['users:read']}>can read</RoleGuard>
        <RoleGuard permissions={['users:read', 'users:write']}>can write</RoleGuard>
      </>,
    );
    expect(screen.getByText('can read')).toBeInTheDocument();
    expect(screen.queryByText('can write')).not.toBeInTheDocument();
  });

  it('combines role and permission requirements', () => {
    render(
      <RoleGuard roles={['ADMIN']} permissions={['roles:write']}>
        manage roles
      </RoleGuard>,
    );
    expect(screen.queryByText('manage roles')).not.toBeInTheDocument();
  });

  it('hides content from signed-out users', () => {
    useAuthStore.getState().clear();
    render(<RoleGuard roles={['USER']}>member area</RoleGuard>);
    expect(screen.queryByText('member area')).not.toBeInTheDocument();
  });
});
