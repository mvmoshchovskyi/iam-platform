import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/features/auth/api';
import { queryKeys } from '@/shared/api/query-keys';
import { useToast } from '@/shared/hooks/useToast';
import { useAuthStore } from '@/shared/stores/auth.store';
import { profileApi, type UpdateProfilePayload } from './api';

/** Re-reads the profile (e.g. after 2FA or email changes) into the auth store. */
export const refreshUser = async () => useAuthStore.getState().setUser(await authApi.me());

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => profileApi.update(payload),
    onSuccess: (user) => setUser(user),
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => profileApi.changePassword(currentPassword, newPassword),
    onSuccess: async () => {
      await refreshUser();
      await queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    },
  });
}

export function useEnableTwoFactor() {
  return useMutation({ mutationFn: profileApi.enableTwoFactor });
}

/**
 * Doesn't refresh the user itself: the caller must first keep the returned recovery codes,
 * because the refreshed `twoFactorEnabled` flag changes which view is rendered.
 */
export function useConfirmTwoFactor() {
  return useMutation({ mutationFn: (code: string) => profileApi.confirmTwoFactor(code) });
}

export function useDisableTwoFactor() {
  const toast = useToast();
  return useMutation({
    mutationFn: (password: string) => profileApi.disableTwoFactor(password),
    onSuccess: async () => {
      await refreshUser();
      toast.success('Two-factor authentication disabled');
    },
  });
}
