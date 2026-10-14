import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/api/query-keys';
import { useToast } from '@/shared/hooks/useToast';
import { adminApi, type AdminUsersParams, type AuditLogParams } from './api';

export function useAdminUsers(params: AdminUsersParams) {
  return useQuery({
    queryKey: queryKeys.admin.users(params),
    queryFn: () => adminApi.users(params),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(id: string | null) {
  return useQuery({
    queryKey: queryKeys.admin.user(id ?? ''),
    queryFn: () => adminApi.user(id!),
    enabled: !!id,
  });
}

export function useRoles() {
  return useQuery({ queryKey: queryKeys.admin.roles, queryFn: adminApi.roles });
}

export function usePermissionList() {
  return useQuery({
    queryKey: queryKeys.admin.permissions,
    queryFn: adminApi.permissions,
    staleTime: Infinity,
  });
}

export function useAuditLogs(params: AuditLogParams) {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(params),
    queryFn: () => adminApi.auditLogs(params),
    placeholderData: keepPreviousData,
  });
}

/** Admin mutations refresh every admin query (lists, details, role counts, audit log). */
function useAdminMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  successMessage: string | ((data: TData, vars: TVars) => string),
) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn,
    onSuccess: (data, vars) =>
      toast.success(
        typeof successMessage === 'function' ? successMessage(data, vars) : successMessage,
      ),
    onError: (error) => toast.error(error),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.all }),
  });
}

export const useUpdateUserRole = () =>
  useAdminMutation(
    (v: { userId: string; roleId: string; roleName: string; action: 'assign' | 'remove' }) =>
      adminApi.updateUserRole(v.userId, v.roleId, v.action),
    (_d, v) =>
      v.action === 'assign' ? `Role ${v.roleName} assigned` : `Role ${v.roleName} removed`,
  );

export const useUpdateUserStatus = () =>
  useAdminMutation(
    (v: { userId: string; isActive?: boolean; unlock?: boolean }) =>
      adminApi.updateUserStatus(v.userId, { isActive: v.isActive, unlock: v.unlock }),
    (_d, v) =>
      v.unlock
        ? 'Account unlocked'
        : v.isActive
          ? 'Account enabled'
          : 'Account disabled and signed out',
  );

export const useCreateRole = () =>
  useAdminMutation(adminApi.createRole, (role) => `Role ${role.name} created`);

export const useUpdateRolePermissions = () =>
  useAdminMutation(
    (v: { id: string; permissions: string[] }) =>
      adminApi.updateRolePermissions(v.id, v.permissions),
    (role) => `Permissions for ${role.name} saved`,
  );

export const useDeleteRole = () =>
  useAdminMutation((id: string) => adminApi.deleteRole(id), 'Role deleted');
