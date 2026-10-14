import type { ReactNode } from 'react';
import { usePermissions } from '@/shared/hooks/usePermissions';

interface RoleGuardProps {
  /** User needs at least one of these roles */
  roles?: string[];
  /** User needs all of these permissions */
  permissions?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders UI based on the user's roles/permissions.
 * UI convenience only — the API enforces authorization on every request.
 */
export function RoleGuard({ roles, permissions, fallback = null, children }: RoleGuardProps) {
  const { hasRole, hasPermission } = usePermissions();
  const allowed =
    (!roles?.length || hasRole(...roles)) &&
    (!permissions?.length || hasPermission(...permissions));
  return allowed ? children : fallback;
}
