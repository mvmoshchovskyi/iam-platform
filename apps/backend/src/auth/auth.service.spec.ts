import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { type DeepMockProxy, mock, mockDeep, type MockProxy } from 'jest-mock-extended';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../database/prisma.service';
import type { PasswordPolicyService } from '../password/password-policy.service';
import { meta, wireTransactions } from '../test-utils/mocks';
import type { IssuedSession, TokenService } from '../tokens/token.service';
import type { EmailVerificationService } from '../users/email-verification.service';
import type { UsersService } from '../users/users.service';
import { AuthService, REGISTER_MESSAGE } from './auth.service';
import { FailureReason, type LoginProtectionService } from './login-protection.service';

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'jane@example.com',
  passwordHash: 'hash',
  firstName: 'Jane',
  lastName: null,
  emailVerifiedAt: new Date('2026-01-01'),
  pendingEmail: null,
  isActive: true,
  lockedUntil: null,
  twoFactorEnabled: false,
  lastLoginAt: null,
  lastLoginIp: null,
  passwordChangedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const session: IssuedSession = {
  accessToken: 'access',
  expiresIn: 900,
  refreshToken: 'refresh',
  refreshExpiresAt: new Date(),
  sessionId: 'family-1',
};

describe('AuthService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let users: MockProxy<UsersService>;
  let passwords: MockProxy<PasswordPolicyService>;
  let emailVerification: MockProxy<EmailVerificationService>;
  let tokens: MockProxy<TokenService>;
  let protection: MockProxy<LoginProtectionService>;
  let service: AuthService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    wireTransactions(prisma);
    users = mock<UsersService>();
    passwords = mock<PasswordPolicyService>();
    emailVerification = mock<EmailVerificationService>();
    tokens = mock<TokenService>();
    protection = mock<LoginProtectionService>();
    service = new AuthService(
      prisma,
      users,
      passwords,
      emailVerification,
      mock<AuditService>(),
      tokens,
      protection,
    );
  });

  describe('register', () => {
    const dto = {
      email: 'jane@example.com',
      password: 'violet-Tractor-sings-42',
      firstName: 'Jane',
    };

    it('rejects weak passwords before touching the database', async () => {
      passwords.assertStrong.mockImplementation(() => {
        throw new BadRequestException('weak');
      });
      await expect(service.register(dto, meta)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates the user with the USER role, history entry and sends a verification email', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.hash.mockResolvedValue('bcrypt-hash');
      const created = buildUser({ emailVerifiedAt: null });
      prisma.user.create.mockResolvedValue(created);

      await expect(service.register(dto, meta)).resolves.toEqual({ message: REGISTER_MESSAGE });

      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        email: dto.email,
        passwordHash: 'bcrypt-hash',
        passwordHistory: { create: { passwordHash: 'bcrypt-hash' } },
        roles: { create: { role: { connect: { name: 'USER' } } } },
      });
      expect(emailVerification.createAndSend).toHaveBeenCalledWith(created, created.email, false);
    });

    it('returns the same response for an existing email (no enumeration) and re-sends if unverified', async () => {
      const existing = buildUser({ emailVerifiedAt: null });
      users.findByEmail.mockResolvedValue(existing);

      await expect(service.register(dto, meta)).resolves.toEqual({ message: REGISTER_MESSAGE });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(emailVerification.createAndSend).toHaveBeenCalledWith(existing, existing.email, false);
    });
  });

  describe('login', () => {
    const dto = { email: 'jane@example.com', password: 'secret', rememberMe: true };

    it('records a failure and returns a generic 401 for unknown users', async () => {
      users.findByEmail.mockResolvedValue(null);
      passwords.compare.mockResolvedValue(false);
      protection.recordFailure.mockResolvedValue(null);

      await expect(service.login(dto, meta)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(passwords.compare).toHaveBeenCalledWith('secret', undefined);
      expect(protection.recordFailure).toHaveBeenCalledWith(
        null,
        dto.email,
        meta,
        FailureReason.INVALID_CREDENTIALS,
      );
    });

    it('locks the account when the failure crosses the threshold', async () => {
      const user = buildUser();
      users.findByEmail.mockResolvedValue(user);
      passwords.compare.mockResolvedValue(false);
      const until = new Date(Date.now() + 60_000);
      protection.recordFailure.mockResolvedValue(until);
      protection.lockedException.mockReturnValue(new HttpException('locked', 423));

      await expect(service.login(dto, meta)).rejects.toMatchObject({ status: 423 });
      expect(protection.lockedException).toHaveBeenCalledWith(until);
    });

    it('refuses sign-in for unverified emails', async () => {
      users.findByEmail.mockResolvedValue(buildUser({ emailVerifiedAt: null }));
      passwords.compare.mockResolvedValue(true);

      await expect(service.login(dto, meta)).rejects.toBeInstanceOf(ForbiddenException);
      expect(protection.recordAttempt).toHaveBeenCalledWith(
        'user-1',
        dto.email,
        meta,
        FailureReason.EMAIL_NOT_VERIFIED,
      );
      expect(tokens.issueSession).not.toHaveBeenCalled();
    });

    it('returns a 2FA challenge instead of tokens when TOTP is enabled', async () => {
      users.findByEmail.mockResolvedValue(buildUser({ twoFactorEnabled: true }));
      passwords.compare.mockResolvedValue(true);
      tokens.signTwoFactorChallenge.mockResolvedValue('challenge');

      await expect(service.login(dto, meta)).resolves.toEqual({
        requiresTwoFactor: true,
        twoFactorToken: 'challenge',
      });
      expect(tokens.signTwoFactorChallenge).toHaveBeenCalledWith('user-1', true);
      expect(tokens.issueSession).not.toHaveBeenCalled();
    });

    it('issues a session honouring rememberMe on success', async () => {
      const user = buildUser();
      users.findByEmail.mockResolvedValue(user);
      passwords.compare.mockResolvedValue(true);
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);
      protection.recordSuccess.mockResolvedValue({ suspicious: false });
      tokens.issueSession.mockResolvedValue(session);
      users.getProfile.mockResolvedValue({ id: 'user-1' } as never);

      const result = await service.login(dto, meta);

      expect(result).toMatchObject({ requiresTwoFactor: false, session });
      expect(protection.assertNotBackedOff).toHaveBeenCalledWith(dto.email, meta);
      expect(protection.recordSuccess).toHaveBeenCalledWith(user, meta);
      expect(tokens.issueSession).toHaveBeenCalledWith('user-1', meta, { rememberMe: true });
    });
  });

  describe('logout', () => {
    it('is a no-op for unknown or already revoked tokens', async () => {
      tokens.findActiveByRawToken.mockResolvedValue(null);
      await service.logout('stale', meta);
      expect(tokens.revokeFamily).not.toHaveBeenCalled();
    });
  });
});
