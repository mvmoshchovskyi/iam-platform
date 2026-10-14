import type { AuthResponse, User } from '@/shared/types/api';

export const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'jane@example.com',
  firstName: 'Jane',
  lastName: 'Doe',
  emailVerified: true,
  pendingEmail: null,
  twoFactorEnabled: false,
  isActive: true,
  lockedUntil: null,
  lastLoginAt: '2026-10-01T10:00:00.000Z',
  lastLoginIp: '203.0.113.7',
  passwordChangedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  roles: ['USER'],
  permissions: [],
  ...overrides,
});

export const authResponse = (accessToken: string, user: User = buildUser()): AuthResponse => ({
  requiresTwoFactor: false,
  accessToken,
  tokenType: 'Bearer',
  expiresIn: 900,
  user,
});

export const problem = (status: number, code: string, detail = code) => ({
  type: `https://httpstatuses.io/${status}`,
  title: 'Error',
  status,
  detail,
  instance: '/api/test',
  code,
});
