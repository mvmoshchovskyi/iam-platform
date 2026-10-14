import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { PasswordStrengthMeter } from '@/features/auth/components/PasswordStrengthMeter';
import { type ChangePasswordValues, changePasswordSchema } from '@/features/auth/schemas';
import { useChangePassword } from '@/features/profile/hooks';
import { getErrorCode, getErrorMessage } from '@/shared/api/problem';
import { FormField } from '@/shared/components/FormField';
import { fieldA11y } from '@/shared/lib/a11y';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { PageHeader } from '@/shared/components/PageHeader';
import { SectionCard } from '@/shared/components/SectionCard';
import { Button } from '@/shared/components/ui/button';
import { useAuth } from '@/shared/hooks/useAuth';
import { useToast } from '@/shared/hooks/useToast';
import { formatDateTime } from '@/shared/lib/format';

export default function ProfilePasswordPage() {
  const { user } = useAuth();
  const change = useChangePassword();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const newPassword = useWatch({ control, name: 'newPassword' });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) =>
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: ({ revokedSessions }) => {
          reset();
          toast.success(
            'Password changed',
            revokedSessions ? `${revokedSessions} other session(s) were signed out.` : undefined,
          );
        },
        onError: (error) => {
          const code = getErrorCode(error);
          const message = getErrorMessage(error);
          if (code === 'INVALID_PASSWORD') setError('currentPassword', { message });
          else if (code === 'WEAK_PASSWORD' || code === 'PASSWORD_REUSED')
            setError('newPassword', { message });
          else toast.error(error);
        },
      },
    ),
  );

  return (
    <>
      <PageHeader
        title="Password"
        description={`Last changed ${formatDateTime(user?.passwordChangedAt)}.`}
      />
      <SectionCard
        title="Change password"
        description="Other devices will be signed out. You can't reuse any of your last 5 passwords."
        className="max-w-2xl"
      >
        <form className="grid gap-4" noValidate onSubmit={onSubmit}>
          <FormField
            id="currentPassword"
            label="Current password"
            error={errors.currentPassword?.message}
          >
            <PasswordInput
              {...fieldA11y('currentPassword', errors.currentPassword?.message)}
              autoComplete="current-password"
              autoFocus
              {...register('currentPassword')}
            />
          </FormField>
          <FormField id="newPassword" label="New password" error={errors.newPassword?.message}>
            <PasswordInput
              {...fieldA11y('newPassword', errors.newPassword?.message)}
              autoComplete="new-password"
              {...register('newPassword')}
            />
          </FormField>
          <PasswordStrengthMeter
            password={newPassword}
            userInputs={[user?.email, user?.firstName ?? undefined]}
          />
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
          <div className="flex justify-end">
            <Button type="submit" disabled={change.isPending}>
              {change.isPending && <LoadingSpinner className="size-4 text-current" />}
              Update password
            </Button>
          </div>
        </form>
      </SectionCard>
    </>
  );
}
