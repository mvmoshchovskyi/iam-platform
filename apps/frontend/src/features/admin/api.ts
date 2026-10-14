import { http } from '@/shared/api';
import type {
  AdminSession,
  AdminUser,
  AuditLog,
  Paginated,
  PermissionItem,
  Role,
} from '@/shared/types/api';

export interface AdminUsersParams {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  status?: 'active' | 'disabled' | 'locked' | 'unverified';
  sortBy?: 'createdAt' | 'email' | 'lastLoginAt';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditLogParams {
  page: number;
  limit: number;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
}

/** Drops empty filters so they don't hit strict server-side validation. */
const clean = <T extends object>(params: T) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));

export const adminApi = {
  users: (params: AdminUsersParams) =>
    http.get<Paginated<AdminUser>>('/admin/users', { params: clean(params) }).then((r) => r.data),
  user: (id: string) => http.get<AdminUser>(`/admin/users/${id}`).then((r) => r.data),
  updateUserRole: (id: string, roleId: string, action: 'assign' | 'remove') =>
    http.patch<AdminUser>(`/admin/users/${id}/role`, { roleId, action }).then((r) => r.data),
  updateUserStatus: (id: string, body: { isActive?: boolean; unlock?: boolean }) =>
    http.patch<AdminUser>(`/admin/users/${id}/status`, body).then((r) => r.data),
  roles: () => http.get<Role[]>('/admin/roles').then((r) => r.data),
  permissions: () => http.get<PermissionItem[]>('/admin/permissions').then((r) => r.data),
  createRole: (body: { name: string; description?: string; permissions: string[] }) =>
    http.post<Role>('/admin/roles', body).then((r) => r.data),
  updateRolePermissions: (id: string, permissions: string[]) =>
    http.patch<Role>(`/admin/roles/${id}/permissions`, { permissions }).then((r) => r.data),
  deleteRole: (id: string) => http.delete<void>(`/admin/roles/${id}`).then(() => undefined),
  auditLogs: (params: AuditLogParams) =>
    http
      .get<Paginated<AuditLog>>('/admin/audit-logs', { params: clean(params) })
      .then((r) => r.data),
  sessions: (params: { page: number; limit: number; userId?: string }) =>
    http
      .get<Paginated<AdminSession>>('/admin/sessions', { params: clean(params) })
      .then((r) => r.data),
};
