import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { FormAlert } from '@/features/auth/components/FormAlert';
import { useForgotPassword } from '@/features/auth/hooks';
import { type EmailOnlyValues, emailOnlySchema } from '@/features/auth/schemas';
import { getErrorMessage } from '@/shared/api/problem';
import { FormField } from '@/shared/components/FormField';
import { fieldA11y } from '@/shared/lib/a11y';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

export default function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<EmailOnlyValues>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  });

  const backToLogin = (
    <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
      Back to sign in
    </Link>
  );

  if (forgot.isSuccess) {
    return (
      <AuthCard title="Check your email" footer={backToLogin}>
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="size-12 text-primary" />
          <p className="text-sm text-muted-foreground">
            If an account exists for{' '}
            <span className="font-medium text-foreground">{getValues('email')}</span>, a reset link
            is on its way. It expires in 1 hour and works once.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your email and we'll send you a reset link."
      footer={backToLogin}
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={handleSubmit(({ email }) => forgot.mutate(email))}
      >
        {forgot.isError && <FormAlert>{getErrorMessage(forgot.error)}</FormAlert>}
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            {...fieldA11y('email', errors.email?.message)}
            type="email"
            autoComplete="email"
            autoFocus
            {...register('email')}
          />
        </FormField>
        <Button type="submit" className="w-full" disabled={forgot.isPending}>
          {forgot.isPending && <LoadingSpinner className="size-4 text-current" />}
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
