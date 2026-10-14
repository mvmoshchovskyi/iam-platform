/** Mirrors the backend AuditAction constants. */
export const AUDIT_ACTIONS = [
  'USER_REGISTERED',
  'EMAIL_VERIFIED',
  'EMAIL_CHANGE_REQUESTED',
  'PROFILE_UPDATED',
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'SUSPICIOUS_LOGIN',
  'ACCOUNT_LOCKED',
  'ACCOUNT_UNLOCKED',
  'TOKEN_REUSE_DETECTED',
  'LOGOUT',
  'LOGOUT_ALL',
  'SESSION_REVOKED',
  'TWO_FACTOR_ENABLED',
  'TWO_FACTOR_DISABLED',
  'TWO_FACTOR_FAILED',
  'RECOVERY_CODE_USED',
  'PASSWORD_CHANGED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET',
  'ROLE_ASSIGNED',
  'ROLE_REMOVED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_DELETED',
  'USER_STATUS_CHANGED',
] as const;

const DANGER = [
  'LOGIN_FAILED',
  'SUSPICIOUS_LOGIN',
  'ACCOUNT_LOCKED',
  'TOKEN_REUSE_DETECTED',
  'TWO_FACTOR_FAILED',
];

export const actionVariant = (action: string): 'destructive' | 'secondary' | 'outline' =>
  DANGER.includes(action)
    ? 'destructive'
    : action.startsWith('ROLE_') || action === 'USER_STATUS_CHANGED'
      ? 'secondary'
      : 'outline';
