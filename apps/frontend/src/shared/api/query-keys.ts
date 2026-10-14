export const queryKeys = {
  sessions: ['sessions'] as const,
  admin: {
    all: ['admin'] as const,
    users: (params: object) => ['admin', 'users', params] as const,
    user: (id: string) => ['admin', 'user', id] as const,
    roles: ['admin', 'roles'] as const,
    permissions: ['admin', 'permissions'] as const,
    auditLogs: (params: object) => ['admin', 'audit-logs', params] as const,
  },
};
