import { z } from 'zod';

export const emailSchema = z.email('Enter a valid email address').max(254).trim().toLowerCase();

/** Mirrors the API policy: 10–72 chars (bcrypt limit); strength is checked by zxcvbn server-side. */
export const newPasswordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(72, 'Use at most 72 characters');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean(),
});
export type LoginValues = z.infer<typeof loginSchema>;

const passwordsMatch = { message: 'Passwords do not match', path: ['confirmPassword'] };

export const registerSchema = z
  .object({
    email: emailSchema,
    firstName: z.string().trim().max(50).optional(),
    lastName: z.string().trim().max(50).optional(),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch);
export type RegisterValues = z.infer<typeof registerSchema>;

export const emailOnlySchema = z.object({ email: emailSchema });
export type EmailOnlyValues = z.infer<typeof emailOnlySchema>;

export const resetPasswordSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, passwordsMatch);
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, passwordsMatch);
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
