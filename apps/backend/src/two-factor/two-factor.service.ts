import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { TwoFactorSecret } from '@prisma/client';
import type Redis from 'ioredis';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { FailureReason, LoginProtectionService } from '../auth/login-protection.service';
import type { SessionResult } from '../auth/session-response';
import { decrypt, encrypt, sha256 } from '../common/utils/crypto.util';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { PasswordPolicyService } from '../password/password-policy.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { TokenService } from '../tokens/token.service';
import type { RecoveryCodesDto, TwoFactorSetupDto, VerifyTwoFactorDto } from './dto/two-factor.dto';

const RECOVERY_CODE_COUNT = 10;

/** RFC 6238 TOTP: SHA-1, 6 digits, 30 s step — the defaults Google & Microsoft Authenticator expect. */
const totp = authenticator.clone({ window: 1 });

const normalizeRecoveryCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, '');

const expiredChallenge = () =>
  new UnauthorizedException({
    message: 'Two-factor session expired, please sign in again',
    code: 'INVALID_2FA_TOKEN',
  });

const invalidCode = () =>
  new UnauthorizedException({ message: 'Invalid authentication code', code: 'INVALID_2FA_CODE' });

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordPolicyService,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
    private readonly protection: LoginProtectionService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Step 1: generate a secret (stored encrypted, unconfirmed) and return the QR code. */
  async enable(userId: string): Promise<TwoFactorSetupDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.twoFactorEnabled) {
      throw new ConflictException({
        message: 'Two-factor authentication is already enabled',
        code: '2FA_ALREADY_ENABLED',
      });
    }

    const secret = totp.generateSecret(20);
    const encryptedSecret = encrypt(secret, this.config.twoFactor.encryptionKey);
    await this.prisma.twoFactorSecret.upsert({
      where: { userId },
      create: { userId, encryptedSecret },
      update: { encryptedSecret, confirmedAt: null, recoveryCodes: [] },
    });

    const otpauthUrl = totp.keyuri(user.email, this.config.twoFactor.issuer, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
    return { otpauthUrl, qrCodeDataUrl, secret };
  }

  /** Step 2: prove possession of the secret; turns 2FA on and returns one-time recovery codes. */
  async confirm(userId: string, code: string, meta: RequestMeta): Promise<RecoveryCodesDto> {
    const record = await this.prisma.twoFactorSecret.findUnique({ where: { userId } });
    if (!record || record.confirmedAt) {
      throw new BadRequestException({
        message: 'Start two-factor setup first',
        code: '2FA_SETUP_NOT_STARTED',
      });
    }
    if (!(await this.checkTotp(userId, record, code))) throw invalidCode();

    const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const hex = randomBytes(5).toString('hex');
      return `${hex.slice(0, 5)}-${hex.slice(5)}`;
    });

    await this.prisma.$transaction([
      this.prisma.twoFactorSecret.update({
        where: { userId },
        data: {
          confirmedAt: new Date(),
          recoveryCodes: recoveryCodes.map((c) => sha256(normalizeRecoveryCode(c))),
        },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } }),
    ]);
    await this.audit.log({ action: AuditAction.TWO_FACTOR_ENABLED, userId, meta });
    return { recoveryCodes };
  }

  async disable(userId: string, password: string, meta: RequestMeta): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.passwords.compare(password, user.passwordHash))) {
      // 400 rather than 401 so clients don't mistake it for an expired session
      throw new BadRequestException({ message: 'Password is incorrect', code: 'INVALID_PASSWORD' });
    }
    if (!user.twoFactorEnabled) {
      throw new BadRequestException({
        message: 'Two-factor authentication is not enabled',
        code: '2FA_NOT_ENABLED',
      });
    }
    await this.prisma.$transaction([
      this.prisma.twoFactorSecret.deleteMany({ where: { userId } }),
      this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } }),
    ]);
    await this.audit.log({ action: AuditAction.TWO_FACTOR_DISABLED, userId, meta });
  }

  /** Second sign-in step: exchanges the challenge token + TOTP/recovery code for a session. */
  async verifyLogin(dto: VerifyTwoFactorDto, meta: RequestMeta): Promise<SessionResult> {
    if (!dto.code === !dto.recoveryCode) {
      throw new BadRequestException({
        message: 'Provide either code or recoveryCode',
        code: 'VALIDATION_FAILED',
      });
    }
    const challenge = await this.tokens.verifyTwoFactorChallenge(dto.twoFactorToken);

    const user = await this.prisma.user.findUnique({
      where: { id: challenge.sub },
      include: { twoFactorSecret: true },
    });
    const secret = user?.twoFactorSecret;
    if (!user || !user.isActive || !user.twoFactorEnabled || !secret?.confirmedAt)
      throw invalidCode();

    await this.protection.assertNotBackedOff(user.email, meta);
    await this.protection.assertNotLocked(user, meta);

    // A challenge token completes at most one sign-in. Checked before the code so a replayed
    // challenge cannot burn a recovery code; claimed atomically after success.
    const challengeKey = `2fa:challenge-used:${challenge.jti}`;
    if (await this.redis.exists(challengeKey)) throw expiredChallenge();

    const ok = dto.code
      ? await this.checkTotp(user.id, secret, dto.code)
      : await this.consumeRecoveryCode(secret, dto.recoveryCode!);

    if (!ok) {
      await this.audit.log({ action: AuditAction.TWO_FACTOR_FAILED, userId: user.id, meta });
      const lockedUntil = await this.protection.recordFailure(
        user,
        user.email,
        meta,
        FailureReason.INVALID_2FA,
      );
      if (lockedUntil) throw this.protection.lockedException(lockedUntil);
      throw invalidCode();
    }

    const claimed = await this.redis.set(
      challengeKey,
      '1',
      'EX',
      this.config.jwt.twoFactorTtl,
      'NX',
    );
    if (!claimed) throw expiredChallenge();

    if (dto.recoveryCode) {
      await this.audit.log({
        action: AuditAction.RECOVERY_CODE_USED,
        userId: user.id,
        meta,
        metadata: { remaining: secret.recoveryCodes.length - 1 },
      });
    }
    return this.auth.completeLogin(user.id, meta, challenge.rme);
  }

  /** Verifies a TOTP code and blocks replay of the same code within its validity window. */
  private async checkTotp(userId: string, record: TwoFactorSecret, code: string): Promise<boolean> {
    const secret = decrypt(record.encryptedSecret, this.config.twoFactor.encryptionKey);
    if (!totp.check(code, secret)) return false;
    const fresh = await this.redis.set(`totp:used:${userId}:${code}`, '1', 'EX', 90, 'NX');
    return fresh === 'OK';
  }

  /** Atomically removes a recovery code; concurrent use of the same code succeeds only once. */
  private async consumeRecoveryCode(record: TwoFactorSecret, code: string): Promise<boolean> {
    const hash = sha256(normalizeRecoveryCode(code));
    if (!record.recoveryCodes.includes(hash)) return false;
    const { count } = await this.prisma.twoFactorSecret.updateMany({
      where: { id: record.id, recoveryCodes: { has: hash } },
      data: { recoveryCodes: record.recoveryCodes.filter((h) => h !== hash) },
    });
    return count === 1;
  }
}
