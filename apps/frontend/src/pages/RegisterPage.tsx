import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { FormAlert } from '@/features/auth/components/FormAlert';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { PasswordStrengthMeter } from '@/features/auth/components/PasswordStrengthMeter';
import { useRegister } from '@/features/auth/hooks';
import { type RegisterValues, registerSchema } from '@/features/auth/schemas';
import { applyFieldErrors, getErrorMessage } from '@/shared/api/problem';
import { FormField } from '@/shared/components/FormField';
import { fieldA11y } from '@/shared/lib/a11y';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

export default function RegisterPage() {
  const registerUser = useRegister();
  const {
    register,
    handleSubmit,
    control,
    setError,
    getValues,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', firstName: '', lastName: '', password: '', confirmPassword: '' },
  });

  const [password, email, firstName, lastName] = useWatch({
    control,
    name: ['password', 'email', 'firstName', 'lastName'],
  });

  const onSubmit = handleSubmit(({ confirmPassword: _confirm, firstName, lastName, ...values }) =>
    registerUser.mutate(
      { ...values, firstName: firstName || undefined, lastName: lastName || undefined },
      { onError: (error) => applyFieldErrors(error, setError) },
    ),
  );

  if (registerUser.isSuccess) {
    return (
      <AuthCard title="Check your inbox" description="One more step to activate your account.">
        <div className="flex flex-col items-center gap-4 text-center">
          <MailCheck className="size-12 text-primary" />
          <p className="text-sm text-muted-foreground">
            If <span className="font-medium text-foreground">{getValues('email')}</span> can be
            used, we sent a confirmation link to it. The link expires in 24 hours.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to={`/verify-email?email=${encodeURIComponent(getValues('email'))}`}>
                Resend email
              </Link>
            </Button>
            <Button asChild>
              <Link to="/login">Go to sign in</Link>
            </Button>
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create an account"
      description="Secure by default: strong passwords, 2FA and session control."
      footer={
        <span>
          Already registered?{' '}
          <Link
            to="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        {registerUser.isError && !Object.keys(errors).length && (
          <FormAlert>{getErrorMessage(registerUser.error)}</FormAlert>
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

        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            {...fieldA11y('email', errors.email?.message)}
            type="email"
            autoComplete="email"
            {...register('email')}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          description="At least 10 characters. A few unrelated words work great."
        >
          <PasswordInput
            {...fieldA11y('password', errors.password?.message)}
            autoComplete="new-password"
            {...register('password')}
          />
        </FormField>
        <PasswordStrengthMeter password={password} userInputs={[email, firstName, lastName]} />

        <FormField
          id="confirmPassword"
          label="Confirm password"
          error={errors.confirmPassword?.message}
        >
          <PasswordInput
            {...fieldA11y('confirmPassword', errors.confirmPassword?.message)}
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        </FormField>

        <Button type="submit" className="w-full" disabled={registerUser.isPending}>
          {registerUser.isPending && <LoadingSpinner className="size-4 text-current" />}
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
