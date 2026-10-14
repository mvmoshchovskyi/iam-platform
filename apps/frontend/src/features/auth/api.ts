import { http } from '@/shared/api';
import type { AuthResponse, LoginResponse, MessageResponse, User } from '@/shared/types/api';

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface VerifyTwoFactorPayload {
  twoFactorToken: string;
  code?: string;
  recoveryCode?: string;
}

export const authApi = {
  login: (body: LoginPayload) => http.post<LoginResponse>('/auth/login', body).then((r) => r.data),
  register: (body: RegisterPayload) =>
    http.post<MessageResponse>('/auth/register', body).then((r) => r.data),
  verifyEmail: (token: string) =>
    http.post<MessageResponse>('/auth/verify-email', { token }).then((r) => r.data),
  resendVerification: (email: string) =>
    http.post<MessageResponse>('/auth/resend-verification', { email }).then((r) => r.data),
  forgotPassword: (email: string) =>
    http.post<MessageResponse>('/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token: string, newPassword: string) =>
    http.post<MessageResponse>('/auth/reset-password', { token, newPassword }).then((r) => r.data),
  verifyTwoFactor: (body: VerifyTwoFactorPayload) =>
    http.post<AuthResponse>('/auth/2fa/verify', body).then((r) => r.data),
  logout: () => http.post<void>('/auth/logout').then(() => undefined),
  logoutAll: () => http.post<{ revokedSessions: number }>('/auth/logout-all').then((r) => r.data),
  me: () => http.get<User>('/users/me').then((r) => r.data),
};
