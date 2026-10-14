import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { FormAlert } from '@/features/auth/components/FormAlert';
import { type TwoFactorRouteState, useVerifyTwoFactor } from '@/features/auth/hooks';
import { getErrorCode, getErrorMessage } from '@/shared/api/problem';
import { FormField } from '@/shared/components/FormField';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/shared/components/ui/input-otp';

export default function TwoFactorPage() {
  const state = useLocation().state as TwoFactorRouteState | null;
  const verify = useVerifyTwoFactor();
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  // The challenge token only exists in router state — direct visits go back to sign-in
  if (!state?.twoFactorToken) return <Navigate to="/login" replace />;

  const submit = (payload: { code?: string; recoveryCode?: string }) =>
    verify.mutate(
      {
        payload: { twoFactorToken: state.twoFactorToken, ...payload },
        redirectTo: state.from ?? '/dashboard',
      },
      { onError: () => setCode('') },
    );

  const expired = getErrorCode(verify.error) === 'INVALID_2FA_TOKEN';

  return (
    <AuthCard
      title="Two-factor authentication"
      description={
        mode === 'totp'
          ? 'Enter the 6-digit code from Google Authenticator, Microsoft Authenticator or another TOTP app.'
          : 'Enter one of the recovery codes you saved when enabling 2FA. Each code works once.'
      }
      footer={
        <Link to="/login" className="underline-offset-4 hover:underline">
          Use a different account
        </Link>
      }
    >
      <div className="grid gap-4">
        {verify.isError && (
          <FormAlert>
            <p>{getErrorMessage(verify.error)}</p>
            {expired && (
              <Link to="/login" className="font-medium underline underline-offset-4">
                Sign in again
              </Link>
            )}
          </FormAlert>
        )}

        {mode === 'totp' ? (
          <form
            className="grid justify-items-center gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) submit({ code });
            }}
          >
            <ShieldCheck className="size-10 text-primary" />
            <InputOTP
              maxLength={6}
              value={code}
              onChange={setCode}
              onComplete={(value: string) => submit({ code: value })}
              autoFocus
              inputMode="numeric"
              pattern="^[0-9]*$"
              aria-label="Authentication code"
              disabled={verify.isPending}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
            <Button
              type="submit"
              className="w-full"
              disabled={code.length !== 6 || verify.isPending}
            >
              {verify.isPending && <LoadingSpinner className="size-4 text-current" />}
              Verify
            </Button>
          </form>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (recoveryCode.trim()) submit({ recoveryCode: recoveryCode.trim() });
            }}
          >
            <FormField id="recoveryCode" label="Recovery code">
              <Input
                id="recoveryCode"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="xxxxx-xxxxx"
                autoComplete="one-time-code"
                autoFocus
                className="font-mono"
              />
            </FormField>
            <Button
              type="submit"
              className="w-full"
              disabled={!recoveryCode.trim() || verify.isPending}
            >
              {verify.isPending && <LoadingSpinner className="size-4 text-current" />}
              Verify recovery code
            </Button>
          </form>
        )}

        <Button
          variant="link"
          className="h-auto p-0 text-sm"
          onClick={() => {
            verify.reset();
            setMode(mode === 'totp' ? 'recovery' : 'totp');
          }}
        >
          {mode === 'totp'
            ? 'Lost your device? Use a recovery code'
            : 'Use an authenticator code instead'}
        </Button>
      </div>
    </AuthCard>
  );
}
