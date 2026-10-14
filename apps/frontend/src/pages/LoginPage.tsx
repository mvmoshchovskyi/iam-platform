import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { FormAlert } from '@/features/auth/components/FormAlert';
import { PasswordInput } from '@/features/auth/components/PasswordInput';
import { useLogin } from '@/features/auth/hooks';
import { type LoginValues, loginSchema } from '@/features/auth/schemas';
import { getErrorCode, getErrorMessage, getProblem } from '@/shared/api/problem';
import { FormField } from '@/shared/components/FormField';
import { fieldA11y } from '@/shared/lib/a11y';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

export default function LoginPage() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setValue,
    control,
    getValues,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });
  const rememberMe = useWatch({ control, name: 'rememberMe' });

  const code = getErrorCode(login.error);
  const retryAfter = getProblem(login.error)?.retryAfter;

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back — sign in to manage your account."
      footer={
        <span>
          No account?{' '}
          <Link
            to="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Create one
          </Link>
        </span>
      }
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={handleSubmit((values) => login.mutate(values))}
      >
        {login.isError && (
          <FormAlert>
            <p>{getErrorMessage(login.error)}</p>
            {code === 'EMAIL_NOT_VERIFIED' && (
              <Link
                to={`/verify-email?email=${encodeURIComponent(getValues('email'))}`}
                className="font-medium underline underline-offset-4"
              >
                Resend verification email
              </Link>
            )}
            {(code === 'ACCOUNT_LOCKED' || code === 'LOGIN_BACKOFF') && retryAfter && (
              <p className="text-xs">Try again in about {Math.ceil(retryAfter / 60)} minute(s).</p>
            )}
          </FormAlert>
        )}

        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            {...fieldA11y('email', errors.email?.message)}
            type="email"
            autoComplete="email"
            autoFocus
            {...register('email')}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          labelAction={
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          }
        >
          <PasswordInput
            {...fieldA11y('password', errors.password?.message)}
            autoComplete="current-password"
            {...register('password')}
          />
        </FormField>

        <div className="flex items-center gap-2">
          <Checkbox
            id="rememberMe"
            checked={rememberMe}
            onCheckedChange={(checked) => setValue('rememberMe', checked === true)}
          />
          <Label htmlFor="rememberMe" className="font-normal">
            Remember me for 30 days
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending && <LoadingSpinner className="size-4 text-current" />}
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
