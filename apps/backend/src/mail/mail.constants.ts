export const MAIL_QUEUE = 'mail';

export interface MailJobs {
  'verify-email': { to: string; name: string; url: string; isEmailChange: boolean };
  'reset-password': { to: string; name: string; url: string };
  'suspicious-login': { to: string; name: string; ipAddress: string; device: string; time: string };
  'password-changed': { to: string; name: string; time: string };
}

export type MailTemplate = keyof MailJobs;

export const MAIL_SUBJECTS: Record<MailTemplate, string> = {
  'verify-email': 'Confirm your email address',
  'reset-password': 'Reset your password',
  'suspicious-login': 'New sign-in to your account',
  'password-changed': 'Your password was changed',
};
