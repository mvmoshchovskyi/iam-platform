export const SystemRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

export const Permission = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  AUDIT_READ: 'audit:read',
  SESSIONS_READ: 'sessions:read',
  SESSIONS_WRITE: 'sessions:write',
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  [Permission.USERS_READ]: 'View users',
  [Permission.USERS_WRITE]: 'Manage users (roles, status)',
  [Permission.ROLES_READ]: 'View roles and permissions',
  [Permission.ROLES_WRITE]: 'Create, edit and delete roles',
  [Permission.AUDIT_READ]: 'View audit logs',
  [Permission.SESSIONS_READ]: 'View all active sessions',
  [Permission.SESSIONS_WRITE]: 'Revoke any session',
};

const ALL_PERMISSIONS = Object.values(Permission);

export const SYSTEM_ROLES: Record<SystemRole, { description: string; permissions: Permission[] }> =
  {
    [SystemRole.SUPER_ADMIN]: {
      description: 'Full access to the platform',
      permissions: ALL_PERMISSIONS,
    },
    [SystemRole.ADMIN]: {
      description: 'Administers users, sessions and audit logs',
      permissions: ALL_PERMISSIONS.filter((p) => p !== Permission.ROLES_WRITE),
    },
    [SystemRole.USER]: { description: 'Regular user', permissions: [] },
  };
