import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormAlert } from '@/features/auth/components/FormAlert';
import { useResendVerification } from '@/features/auth/hooks';
import { emailSchema } from '@/features/auth/schemas';
import { useUpdateProfile } from '@/features/profile/hooks';
import { applyFieldErrors } from '@/shared/api/problem';
import { FormField } from '@/shared/components/FormField';
import { fieldA11y } from '@/shared/lib/a11y';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { PageHeader } from '@/shared/components/PageHeader';
import { SectionCard } from '@/shared/components/SectionCard';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { useAuth } from '@/shared/hooks/useAuth';
import { useToast } from '@/shared/hooks/useToast';

const profileSchema = z.object({
  firstName: z.string().trim().max(50),
  lastName: z.string().trim().max(50),
  email: emailSchema,
});
type ProfileValues = z.infer<typeof profileSchema>;

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const update = useUpdateProfile();
  const resend = useResendVerification();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
    },
  });

  if (!user) return null;

  const onSubmit = handleSubmit((values) =>
    update.mutate(
      {
        firstName: values.firstName || undefined,
        lastName: values.lastName || undefined,
        ...(values.email !== user.email && { email: values.email }),
      },
      {
        onSuccess: (updated) => {
          reset({
            firstName: updated.firstName ?? '',
            lastName: updated.lastName ?? '',
            email: updated.email,
          });
          toast.success(
            'Profile updated',
            values.email !== user.email
              ? `Confirm ${values.email} via the link we just sent.`
              : undefined,
          );
        },
        onError: (error) => {
          if (!applyFieldErrors(error, setError)) toast.error(error);
        },
      },
    ),
  );

  return (
    <>
      <PageHeader title="Profile" description="Your personal details and sign-in email." />
      <SectionCard
        title="Personal information"
        description="Changing your email requires confirming the new address."
        className="max-w-2xl"
      >
        <form id="profile-form" className="grid gap-4" noValidate onSubmit={onSubmit}>
          {user.pendingEmail && (
            <FormAlert variant="info">
              <p>
                Email change pending: confirm{' '}
                <span className="font-medium">{user.pendingEmail}</span> using the link we sent.
                Until then you sign in with {user.email}.
              </p>
            </FormAlert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="firstName" label="First name" error={errors.firstName?.message}>
              <Input
                {...fieldA11y('firstName', errors.firstName?.message)}
                autoComplete="given-name"
                autoFocus
                {...register('firstName')}
              />
            </FormField>
            <FormField id="lastName" label="Last name" error={errors.lastName?.message}>
              <Input
                {...fieldA11y('lastName', errors.lastName?.message)}
                autoComplete="family-name"
                {...register('lastName')}
              />
            </FormField>
          </div>
          <FormField
            id="email"
            label="Email"
            error={errors.email?.message}
            labelAction={
              user.emailVerified ? (
                <Badge variant="secondary">Verified</Badge>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-xs"
                  disabled={resend.isPending}
                  onClick={() =>
                    resend.mutate(user.email, { onSuccess: (d) => toast.success(d.message) })
                  }
                >
                  Resend verification
                </Button>
              )
            }
          >
            <Input
              {...fieldA11y('email', errors.email?.message)}
              type="email"
              autoComplete="email"
              {...register('email')}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!isDirty || update.isPending}
              onClick={() => reset()}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isDirty || update.isPending}>
              {update.isPending && <LoadingSpinner className="size-4 text-current" />}
              Save changes
            </Button>
          </div>
        </form>
      </SectionCard>
    </>
  );
}
