import { http } from '@/shared/api';
import type { User } from '@/shared/types/api';

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface TwoFactorSetup {
  otpauthUrl: string;
  qrCodeDataUrl: string;
  secret: string;
}

export const profileApi = {
  update: (body: UpdateProfilePayload) => http.patch<User>('/users/me', body).then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    http
      .post<{ message: string; revokedSessions: number }>('/auth/change-password', {
        currentPassword,
        newPassword,
      })
      .then((r) => r.data),
  enableTwoFactor: () => http.post<TwoFactorSetup>('/auth/2fa/enable').then((r) => r.data),
  confirmTwoFactor: (code: string) =>
    http.post<{ recoveryCodes: string[] }>('/auth/2fa/confirm', { code }).then((r) => r.data),
  disableTwoFactor: (password: string) =>
    http.post<void>('/auth/2fa/disable', { password }).then(() => undefined),
};
