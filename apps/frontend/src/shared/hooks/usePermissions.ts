import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/shared/stores/auth.store';
import { ADMIN_ROLES } from '@/shared/types/api';

/**
 * Role/permission checks for rendering decisions only — the API enforces authorization
 * independently on every request.
 */
export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const roles = useMemo(() => user?.roles ?? [], [user]);
  const permissions = useMemo(() => user?.permissions ?? [], [user]);

  const hasRole = useCallback(
    (...required: string[]) => required.some((r) => roles.includes(r)),
    [roles],
  );
  const hasPermission = useCallback(
    (...required: string[]) => required.every((p) => permissions.includes(p)),
    [permissions],
  );

  return { roles, permissions, hasRole, hasPermission, isAdmin: hasRole(...ADMIN_ROLES) };
}
