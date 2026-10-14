import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { useToast } from '@/shared/hooks/useToast';
import { useAuthStore } from '@/shared/stores/auth.store';
import type { AuthResponse } from '@/shared/types/api';
import {
  authApi,
  type LoginPayload,
  type RegisterPayload,
  type VerifyTwoFactorPayload,
} from './api';

export interface TwoFactorRouteState {
  twoFactorToken: string;
  from?: string;
}

const useRedirectTarget = () => {
  const location = useLocation();
  const state = location.state as { from?: { pathname: string } | string } | null;
  const from = typeof state?.from === 'string' ? state.from : state?.from?.pathname;
  return from && from !== '/login' ? from : '/dashboard';
};

/** Signs in; routes to /2fa when the account requires a second factor. */
export function useLogin() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const redirectTo = useRedirectTarget();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
    onSuccess: (result) => {
      if (result.requiresTwoFactor) {
        navigate('/2fa', {
          state: {
            twoFactorToken: result.twoFactorToken,
            from: redirectTo,
          } satisfies TwoFactorRouteState,
        });
        return;
      }
      setSession(result.accessToken, result.user);
      navigate(redirectTo, { replace: true });
    },
  });
}

export function useVerifyTwoFactor() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: ({ payload }: { payload: VerifyTwoFactorPayload; redirectTo: string }) =>
      authApi.verifyTwoFactor(payload),
    onSuccess: (result: AuthResponse, { redirectTo }) => {
      setSession(result.accessToken, result.user);
      navigate(redirectTo, { replace: true });
    },
  });
}

/**
 * Clears local auth state and every cached query (so no user data survives), then revokes
 * the server session. Local logout happens even if the network call fails.
 */
export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const clear = useAuthStore((s) => s.clear);
  const toast = useToast();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: (_data, error) => {
      clear();
      queryClient.clear();
      navigate('/login', { replace: true });
      if (error)
        toast.info(
          'Signed out locally',
          'The server session could not be revoked; it will expire on its own.',
        );
    },
  });
}

export function useRegister() {
  return useMutation({ mutationFn: (payload: RegisterPayload) => authApi.register(payload) });
}

export function useVerifyEmail() {
  return useMutation({ mutationFn: (token: string) => authApi.verifyEmail(token) });
}

export function useResendVerification() {
  return useMutation({ mutationFn: (email: string) => authApi.resendVerification(email) });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => authApi.forgotPassword(email) });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authApi.resetPassword(token, password),
  });
}
