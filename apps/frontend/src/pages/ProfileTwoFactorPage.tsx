import { ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { FormAlert } from '@/features/auth/components/FormAlert';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import type { TwoFactorSetup } from '@/features/profile/api';
import { RecoveryCodes } from '@/features/profile/components/RecoveryCodes';
import {
  refreshUser,
  useConfirmTwoFactor,
  useDisableTwoFactor,
  useEnableTwoFactor,
} from '@/features/profile/hooks';
import { getErrorMessage } from '@/shared/api/problem';
import { FormField } from '@/shared/components/FormField';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { PageHeader } from '@/shared/components/PageHeader';
import { SectionCard } from '@/shared/components/SectionCard';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/shared/components/ui/input-otp';
import { useAuth } from '@/shared/hooks/useAuth';
import { useToast } from '@/shared/hooks/useToast';

function SetupFlow({ onEnabled }: { onEnabled: (recoveryCodes: string[]) => void }) {
  const enable = useEnableTwoFactor();
  const confirm = useConfirmTwoFactor();
  const toast = useToast();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');

  if (!setup) {
    return (
      <SectionCard
        title="Two-factor authentication"
        description="Add a second step to sign-in using an authenticator app."
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ShieldOff className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Works with Google Authenticator, Microsoft Authenticator, 1Password and other TOTP
              apps.
            </p>
          </div>
          <Button
            disabled={enable.isPending}
            onClick={() =>
              enable.mutate(undefined, { onSuccess: setSetup, onError: (e) => toast.error(e) })
            }
          >
            {enable.isPending && <LoadingSpinner className="size-4 text-current" />}
            Enable 2FA
          </Button>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Set up your authenticator"
      description="Scan the QR code, then enter the 6-digit code it shows."
      className="max-w-2xl"
    >
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <img
          src={setup.qrCodeDataUrl}
          alt="QR code for authenticator app"
          className="size-48 rounded-lg border bg-white p-2"
        />
        <div className="space-y-4">
          <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
            <li>Open your authenticator app and add an account.</li>
            <li>Scan the QR code — or enter this key manually:</li>
          </ol>
          <code className="block rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
            {setup.secret}
          </code>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              confirm.mutate(code, {
                onSuccess: ({ recoveryCodes }) => onEnabled(recoveryCodes),
                onError: () => setCode(''),
              });
            }}
          >
            <FormField id="totp" label="Verification code">
              <InputOTP
                id="totp"
                maxLength={6}
                value={code}
                onChange={setCode}
                inputMode="numeric"
                autoFocus
                aria-label="Verification code"
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
            </FormField>
            {confirm.isError && <FormAlert>{getErrorMessage(confirm.error)}</FormAlert>}
            <div className="flex gap-2">
              <Button type="submit" disabled={code.length !== 6 || confirm.isPending}>
                {confirm.isPending && <LoadingSpinner className="size-4 text-current" />}
                Verify and enable
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </SectionCard>
  );
}

function EnabledState() {
  const disable = useDisableTwoFactor();
  const [password, setPassword] = useState('');

  return (
    <SectionCard title="Two-factor authentication" className="max-w-2xl">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-8 text-green-600" />
        <div>
          <p className="font-medium">
            Enabled <Badge className="ml-1">TOTP</Badge>
          </p>
          <p className="text-sm text-muted-foreground">
            Sign-in requires a code from your authenticator app.
          </p>
        </div>
      </div>
      <form
        className="mt-6 grid gap-3 border-t pt-6"
        onSubmit={(e) => {
          e.preventDefault();
          disable.mutate(password, { onSettled: () => setPassword('') });
        }}
      >
        <p className="text-sm font-medium">Disable two-factor authentication</p>
        <FormField
          id="disable-password"
          label="Confirm with your password"
          error={disable.isError ? getErrorMessage(disable.error) : undefined}
        >
          <PasswordInput
            id="disable-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </FormField>
        <div>
          <Button type="submit" variant="destructive" disabled={!password || disable.isPending}>
            {disable.isPending && <LoadingSpinner className="size-4 text-current" />}
            Disable 2FA
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

function RecoveryCodesStep({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <SectionCard
      title="Save your recovery codes"
      description="Each code signs you in once if you lose your authenticator. They won't be shown again."
      className="max-w-2xl"
      footer={<Button onClick={onDone}>I've saved my codes</Button>}
    >
      <FormAlert variant="success">Two-factor authentication is now enabled.</FormAlert>
      <div className="mt-4">
        <RecoveryCodes codes={codes} />
      </div>
    </SectionCard>
  );
}

export default function ProfileTwoFactorPage() {
  const { user } = useAuth();
  // Codes from the confirm step are kept here before the profile is refreshed: the refreshed
  // twoFactorEnabled flag would otherwise swap to the "enabled" view before they could be saved.
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  return (
    <>
      <PageHeader
        title="Two-factor authentication"
        description="Protect your account even if your password leaks."
      />
      {newCodes ? (
        <RecoveryCodesStep codes={newCodes} onDone={() => setNewCodes(null)} />
      ) : user?.twoFactorEnabled ? (
        <EnabledState />
      ) : (
        <SetupFlow
          onEnabled={(codes) => {
            setNewCodes(codes);
            void refreshUser();
          }}
        />
      )}
    </>
  );
}
