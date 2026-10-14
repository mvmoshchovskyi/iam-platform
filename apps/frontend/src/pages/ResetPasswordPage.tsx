import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { FormAlert } from '@/features/auth/components/FormAlert';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { PasswordStrengthMeter } from '@/features/auth/components/PasswordStrengthMeter';
import { useResetPassword } from '@/features/auth/hooks';
import { type ResetPasswordValues, resetPasswordSchema } from '@/features/auth/schemas';
import { applyFieldErrors, getErrorCode, getErrorMessage } from '@/shared/api/problem';
import { FormField } from '@/shared/components/FormField';
import { fieldA11y } from '@/shared/lib/a11y';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/useToast';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const toast = useToast();
  const reset = useResetPassword();
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });
  const password = useWatch({ control, name: 'password' });

  if (!token) {
    return (
      <AuthCard title="Invalid reset link">
        <FormAlert>This link is missing its token. Request a new reset email.</FormAlert>
        <Button className="mt-4 w-full" asChild>
          <Link to="/forgot-password">Request a new link</Link>
        </Button>
      </AuthCard>
    );
  }

  const onSubmit = handleSubmit(({ password }) =>
    reset.mutate(
      { token, password },
      {
        onSuccess: (data) => {
          toast.success('Password updated', data.message);
          navigate('/login', { replace: true });
        },
        onError: (error) =>
          applyFieldErrors(error, setError, { password: 'password', newPassword: 'password' }),
      },
    ),
  );

  const tokenInvalid = getErrorCode(reset.error) === 'INVALID_RESET_TOKEN';

  return (
    <AuthCard
      title="Choose a new password"
      description="All your other sessions will be signed out."
    >
      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        {reset.isError && !errors.password && (
          <FormAlert>
            <p>{getErrorMessage(reset.error)}</p>
            {tokenInvalid && (
              <Link to="/forgot-password" className="font-medium underline underline-offset-4">
                Request a new link
              </Link>
            )}
          </FormAlert>
        )}
        <FormField id="password" label="New password" error={errors.password?.message}>
          <PasswordInput
            {...fieldA11y('password', errors.password?.message)}
            autoComplete="new-password"
            autoFocus
            {...register('password')}
          />
        </FormField>
        <PasswordStrengthMeter password={password} />
        <FormField
          id="confirmPassword"
          label="Confirm new password"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            {...fieldA11y('confirmPassword', errors.confirmPassword?.message)}
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={reset.isPending}>
          {reset.isPending && <LoadingSpinner className="size-4 text-current" />}
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
