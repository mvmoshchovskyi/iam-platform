/** Mirrors the backend DTOs (see /api/docs). */

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  pendingEmail: string | null;
  twoFactorEnabled: boolean;
  isActive: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  passwordChangedAt: string | null;
  createdAt: string;
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  requiresTwoFactor: false;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

export interface TwoFactorChallenge {
  requiresTwoFactor: true;
  twoFactorToken: string;
}

export type LoginResponse = AuthResponse | TwoFactorChallenge;

export interface MessageResponse {
  message: string;
}

export interface Session {
  id: string;
  device: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  rememberMe: boolean;
  current: boolean;
}

export interface AdminSession extends Session {
  user: { id: string; email: string };
}

export interface AdminUser extends User {
  activeSessions: number;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
}

export interface PermissionItem {
  id: string;
  key: string;
  description: string | null;
}

export interface AuditLog {
  id: string;
  action: string;
  user: { id: string; email: string } | null;
  actor: { id: string; email: string } | null;
  resource: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** RFC 7807 problem details returned by every API error. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  traceId?: string;
  code?: string;
  errors?: { field: string; messages: string[] }[];
  retryAfter?: number;
}

export const SystemRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  USER: 'USER',
} as const;

export const ADMIN_ROLES = [SystemRole.ADMIN, SystemRole.SUPER_ADMIN];
