import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { FormAlert } from '@/features/auth/components/FormAlert';
import { authApi } from '@/features/auth/api';
import { useResendVerification, useVerifyEmail } from '@/features/auth/hooks';
import { type EmailOnlyValues, emailOnlySchema } from '@/features/auth/schemas';
import { getErrorMessage } from '@/shared/api/problem';
import { FormField } from '@/shared/components/FormField';
import { fieldA11y } from '@/shared/lib/a11y';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useAuth } from '@/shared/hooks/useAuth';
import { useAuthStore } from '@/shared/stores/auth.store';

function ResendForm({ defaultEmail }: { defaultEmail: string }) {
  const resend = useResendVerification();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailOnlyValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: defaultEmail },
  });

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={handleSubmit(({ email }) => resend.mutate(email))}
    >
      {resend.isSuccess && <FormAlert variant="success">{resend.data.message}</FormAlert>}
      {resend.isError && <FormAlert>{getErrorMessage(resend.error)}</FormAlert>}
      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input
          {...fieldA11y('email', errors.email?.message)}
          type="email"
          autoComplete="email"
          autoFocus
          {...register('email')}
        />
      </FormField>
      <Button type="submit" variant="outline" disabled={resend.isPending}>
        {resend.isPending && <LoadingSpinner className="size-4 text-current" />}
        Resend verification email
      </Button>
    </form>
  );
}

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const verify = useVerifyEmail();
  const { isAuthenticated } = useAuth();
  const started = useRef(false);

  useEffect(() => {
    // Tokens are single-use: guard against StrictMode's double effect
    if (!token || started.current) return;
    started.current = true;
    verify.mutate(token, {
      onSuccess: async () => {
        // An email change on a signed-in account: refresh the cached profile
        if (useAuthStore.getState().isAuthenticated)
          useAuthStore.getState().setUser(await authApi.me());
      },
    });
  }, [token, verify]);

  if (!token) {
    return (
      <AuthCard
        title="Verify your email"
        description="Didn't get the link, or it expired? Request a new one."
      >
        <ResendForm defaultEmail={params.get('email') ?? ''} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Email verification">
      {verify.isPending || verify.isIdle ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <LoadingSpinner className="size-8" />
          <p className="text-sm text-muted-foreground">Verifying your email…</p>
        </div>
      ) : verify.isSuccess ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CheckCircle2 className="size-12 text-green-600" />
          <p className="text-sm">{verify.data.message}</p>
          <Button asChild>
            <Link to={isAuthenticated ? '/dashboard' : '/login'}>
              {isAuthenticated ? 'Go to dashboard' : 'Sign in'}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <XCircle className="size-12 text-destructive" />
            <p className="text-sm">{getErrorMessage(verify.error)}</p>
          </div>
          <ResendForm defaultEmail={params.get('email') ?? ''} />
        </div>
      )}
    </AuthCard>
  );
}
