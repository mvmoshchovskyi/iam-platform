import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { TwoFactorSecret, User } from '@prisma/client';
import type Redis from 'ioredis';
import { type DeepMockProxy, mock, mockDeep, type MockProxy } from 'jest-mock-extended';
import { authenticator } from 'otplib';
import type { AuditService } from '../audit/audit.service';
import type { AuthService } from '../auth/auth.service';
import type { LoginProtectionService } from '../auth/login-protection.service';
import { decrypt, encrypt, sha256 } from '../common/utils/crypto.util';
import type { AppConfigService } from '../config/app-config.service';
import type { PrismaService } from '../database/prisma.service';
import type { PasswordPolicyService } from '../password/password-policy.service';
import { meta, testConfig, wireTransactions } from '../test-utils/mocks';
import type { TokenService } from '../tokens/token.service';
import { TwoFactorService } from './two-factor.service';

describe('TwoFactorService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let config: AppConfigService;
  let redis: MockProxy<Redis>;
  let passwords: MockProxy<PasswordPolicyService>;
  let tokens: MockProxy<TokenService>;
  let auth: MockProxy<AuthService>;
  let protection: MockProxy<LoginProtectionService>;
  let service: TwoFactorService;

  const secret = authenticator.generateSecret(20);
  const user = {
    id: 'user-1',
    email: 'jane@example.com',
    isActive: true,
    passwordHash: 'h',
  } as User;
  const secretRecord = (overrides: Partial<TwoFactorSecret> = {}): TwoFactorSecret => ({
    id: 'tfs-1',
    userId: 'user-1',
    encryptedSecret: encrypt(secret, config.twoFactor.encryptionKey),
    recoveryCodes: [],
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    wireTransactions(prisma);
    config = testConfig();
    redis = mock<Redis>();
    redis.set.mockResolvedValue('OK');
    redis.exists.mockResolvedValue(0);
    passwords = mock<PasswordPolicyService>();
    tokens = mock<TokenService>();
    auth = mock<AuthService>();
    protection = mock<LoginProtectionService>();
    service = new TwoFactorService(
      prisma,
      config,
      mock<AuditService>(),
      passwords,
      tokens,
      auth,
      protection,
      redis,
    );
  });

  describe('enable', () => {
    it('stores an encrypted secret and returns an authenticator-compatible otpauth URL and QR code', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...user, twoFactorEnabled: false });

      const result = await service.enable('user-1');

      expect(result.otpauthUrl).toMatch(
        /^otpauth:\/\/totp\/IAM%20Platform:jane%40example\.com\?secret=/,
      );
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      const stored = prisma.twoFactorSecret.upsert.mock.calls[0][0].create.encryptedSecret;
      expect(stored).not.toContain(result.secret);
      expect(decrypt(stored, config.twoFactor.encryptionKey)).toBe(result.secret);
    });

    it('refuses when 2FA is already enabled', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...user, twoFactorEnabled: true });
      await expect(service.enable('user-1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('confirm', () => {
    it('rejects an invalid code', async () => {
      prisma.twoFactorSecret.findUnique.mockResolvedValue(secretRecord());
      await expect(service.confirm('user-1', '000000', meta)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('enables 2FA and returns 10 recovery codes stored only as hashes', async () => {
      prisma.twoFactorSecret.findUnique.mockResolvedValue(secretRecord());

      const { recoveryCodes } = await service.confirm(
        'user-1',
        authenticator.generate(secret),
        meta,
      );

      expect(recoveryCodes).toHaveLength(10);
      expect(new Set(recoveryCodes).size).toBe(10);
      const stored = prisma.twoFactorSecret.update.mock.calls[0][0].data.recoveryCodes as string[];
      expect(stored).toEqual(recoveryCodes.map((c) => sha256(c.replace('-', ''))));
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { twoFactorEnabled: true },
      });
    });

    it('blocks replay of a TOTP code that was already used', async () => {
      prisma.twoFactorSecret.findUnique.mockResolvedValue(secretRecord());
      redis.set.mockResolvedValue(null as never);
      await expect(
        service.confirm('user-1', authenticator.generate(secret), meta),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('verifyLogin', () => {
    const recoveryCode = 'abcde-12345';
    const loginUser = () => ({
      ...user,
      twoFactorEnabled: true,
      twoFactorSecret: secretRecord({
        confirmedAt: new Date(),
        recoveryCodes: [sha256('abcde12345'), sha256('other')],
      }),
    });

    beforeEach(() => {
      tokens.verifyTwoFactorChallenge.mockResolvedValue({
        sub: 'user-1',
        jti: 'challenge-1',
        rme: true,
      } as never);
      auth.completeLogin.mockResolvedValue({ session: {}, user: {} } as never);
    });

    it('requires exactly one of code / recoveryCode', async () => {
      await expect(service.verifyLogin({ twoFactorToken: 't' }, meta)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('completes login with a valid TOTP code and carries rememberMe through', async () => {
      prisma.user.findUnique.mockResolvedValue(loginUser());

      await service.verifyLogin(
        { twoFactorToken: 't', code: authenticator.generate(secret) },
        meta,
      );

      expect(auth.completeLogin).toHaveBeenCalledWith('user-1', meta, true);
      expect(redis.set).toHaveBeenCalledWith(
        '2fa:challenge-used:challenge-1',
        '1',
        'EX',
        300,
        'NX',
      );
    });

    it('consumes a recovery code (case/dash-insensitive) exactly once', async () => {
      prisma.user.findUnique.mockResolvedValue(loginUser());
      prisma.twoFactorSecret.updateMany.mockResolvedValue({ count: 1 });

      await service.verifyLogin(
        { twoFactorToken: 't', recoveryCode: recoveryCode.toUpperCase() },
        meta,
      );

      expect(prisma.twoFactorSecret.updateMany).toHaveBeenCalledWith({
        where: { id: 'tfs-1', recoveryCodes: { has: sha256('abcde12345') } },
        data: { recoveryCodes: [sha256('other')] },
      });
      expect(auth.completeLogin).toHaveBeenCalled();
    });

    it('records a failed attempt (towards lockout) on a wrong code', async () => {
      prisma.user.findUnique.mockResolvedValue(loginUser());
      protection.recordFailure.mockResolvedValue(null);

      await expect(
        service.verifyLogin({ twoFactorToken: 't', code: '000000' }, meta),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(protection.recordFailure).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'user-1' }),
        user.email,
        meta,
        'invalid_2fa',
      );
      expect(auth.completeLogin).not.toHaveBeenCalled();
    });

    it('rejects a challenge token that already completed a sign-in, without burning the code', async () => {
      prisma.user.findUnique.mockResolvedValue(loginUser());
      redis.exists.mockResolvedValue(1);

      await expect(
        service.verifyLogin({ twoFactorToken: 't', recoveryCode }, meta),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_2FA_TOKEN' }),
      });
      expect(prisma.twoFactorSecret.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('disable', () => {
    it('requires the correct password', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue({ ...user, twoFactorEnabled: true });
      passwords.compare.mockResolvedValue(false);
      await expect(service.disable('user-1', 'wrong', meta)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.twoFactorSecret.deleteMany).not.toHaveBeenCalled();
    });
  });
});
