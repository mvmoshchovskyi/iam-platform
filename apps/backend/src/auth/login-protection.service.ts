import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { User } from '@prisma/client';
import type Redis from 'ioredis';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import { sha256 } from '../common/utils/crypto.util';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { describeDevice } from '../common/utils/user-agent.util';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { displayName } from '../users/email-verification.service';

export const FailureReason = {
  INVALID_CREDENTIALS: 'invalid_credentials',
  INVALID_2FA: 'invalid_2fa',
  ACCOUNT_LOCKED: 'account_locked',
  ACCOUNT_DISABLED: 'account_disabled',
  EMAIL_NOT_VERIFIED: 'email_not_verified',
} as const;
export type FailureReason = (typeof FailureReason)[keyof typeof FailureReason];

/** Only wrong secrets count towards lockout — not attempts rejected for other reasons. */
const LOCKOUT_REASONS: FailureReason[] = [
  FailureReason.INVALID_CREDENTIALS,
  FailureReason.INVALID_2FA,
];
const MAX_BACKOFF_SECONDS = 60;

/**
 * Brute-force defences around sign-in:
 *  - every attempt is persisted as a LoginAttempt
 *  - exponential back-off per (email, IP) in Redis: 2s, 4s, 8s … capped at 60s
 *  - account lockout after N failed attempts within the lockout window (auto-unlocks)
 *  - successful sign-ins from a never-seen IP or device are flagged and the user is alerted
 */
@Injectable()
export class LoginProtectionService {
  private readonly logger = new Logger(LoginProtectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async assertNotBackedOff(email: string, meta: RequestMeta): Promise<void> {
    const nextAllowedAt = Number(
      await this.redis.hget(this.backoffKey(email, meta), 'nextAllowedAt'),
    );
    const waitMs = nextAllowedAt - Date.now();
    if (waitMs > 0) {
      const retryAfter = Math.ceil(waitMs / 1000);
      throw new HttpException(
        {
          message: `Too many failed attempts. Try again in ${retryAfter} second(s).`,
          code: 'LOGIN_BACKOFF',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Throws 423 (and records the attempt) if the account is currently locked. */
  async assertNotLocked(user: User, meta: RequestMeta): Promise<void> {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordAttempt(user.id, user.email, meta, FailureReason.ACCOUNT_LOCKED);
      throw this.lockedException(user.lockedUntil);
    }
  }

  lockedException(until: Date): HttpException {
    const retryAfter = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 1000));
    return new HttpException(
      {
        message: 'Account temporarily locked after too many failed sign-in attempts.',
        code: 'ACCOUNT_LOCKED',
        retryAfter,
      },
      HttpStatus.LOCKED,
    );
  }

  /** Records a non-counting failed attempt (correct password but sign-in not allowed). */
  async recordAttempt(
    userId: string | null,
    email: string,
    meta: RequestMeta,
    reason: FailureReason,
  ): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: {
        userId,
        email,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        success: false,
        failureReason: reason,
      },
    });
  }

  /**
   * Records a wrong password / 2FA code, extends the back-off and locks the account once the
   * threshold is reached. Returns the lock expiry if this attempt triggered a lock.
   */
  async recordFailure(
    user: User | null,
    email: string,
    meta: RequestMeta,
    reason: FailureReason,
  ): Promise<Date | null> {
    await this.recordAttempt(user?.id ?? null, email, meta, reason);
    await this.extendBackoff(email, meta);
    await this.audit.log({
      action: AuditAction.LOGIN_FAILED,
      userId: user?.id,
      meta,
      metadata: { email, reason },
    });

    if (!user) return null;

    const { lockoutThreshold, lockoutDurationMin } = this.config.security;
    const now = Date.now();
    const lastSuccess = await this.prisma.loginAttempt.findFirst({
      where: { userId: user.id, success: true },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    // Count failures since the most recent of: window start, last success, last lock expiry
    const since = new Date(
      Math.max(
        now - lockoutDurationMin * 60_000,
        lastSuccess?.createdAt.getTime() ?? 0,
        user.lockedUntil && user.lockedUntil.getTime() <= now ? user.lockedUntil.getTime() : 0,
      ),
    );
    const failures = await this.prisma.loginAttempt.count({
      where: {
        userId: user.id,
        success: false,
        failureReason: { in: LOCKOUT_REASONS },
        createdAt: { gt: since },
      },
    });
    if (failures < lockoutThreshold) return null;

    const lockedUntil = new Date(now + lockoutDurationMin * 60_000);
    await this.prisma.user.update({ where: { id: user.id }, data: { lockedUntil } });
    await this.audit.log({
      action: AuditAction.ACCOUNT_LOCKED,
      userId: user.id,
      meta,
      metadata: { failures, lockedUntil: lockedUntil.toISOString() },
    });
    this.logger.warn(
      { userId: user.id, failures },
      'Account locked after repeated failed sign-ins',
    );
    return lockedUntil;
  }

  /** Persists a successful sign-in, resets back-off and flags logins from new IPs/devices. */
  async recordSuccess(user: User, meta: RequestMeta): Promise<{ suspicious: boolean }> {
    const [knownIp, knownDevice, hasHistory] = await Promise.all([
      this.prisma.loginAttempt.findFirst({
        where: { userId: user.id, success: true, ipAddress: meta.ipAddress },
        select: { id: true },
      }),
      this.prisma.loginAttempt.findFirst({
        where: { userId: user.id, success: true, userAgent: meta.userAgent },
        select: { id: true },
      }),
      this.prisma.loginAttempt.findFirst({
        where: { userId: user.id, success: true },
        select: { id: true },
      }),
    ]);
    // The very first sign-in has nothing to compare against, so it is never suspicious
    const suspicious = Boolean(hasHistory) && (!knownIp || !knownDevice);

    await this.prisma.$transaction([
      this.prisma.loginAttempt.create({
        data: {
          userId: user.id,
          email: user.email,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          success: true,
          suspicious,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date(), lastLoginIp: meta.ipAddress },
      }),
    ]);
    await this.redis.del(this.backoffKey(user.email, meta));

    if (suspicious) {
      await this.audit.log({
        action: AuditAction.SUSPICIOUS_LOGIN,
        userId: user.id,
        meta,
        metadata: { newIp: !knownIp, newDevice: !knownDevice },
      });
      await this.mail.send('suspicious-login', {
        to: user.email,
        name: displayName(user),
        ipAddress: meta.ipAddress ?? 'unknown',
        device: describeDevice(meta.userAgent),
        time: new Date().toUTCString(),
      });
    }
    return { suspicious };
  }

  private async extendBackoff(email: string, meta: RequestMeta): Promise<void> {
    const key = this.backoffKey(email, meta);
    const failures = await this.redis.hincrby(key, 'failures', 1);
    // First failure is free (typos happen); then 2s, 4s, 8s … capped
    const delaySeconds = failures < 2 ? 0 : Math.min(2 ** (failures - 1), MAX_BACKOFF_SECONDS);
    await this.redis
      .multi()
      .hset(key, 'nextAllowedAt', String(Date.now() + delaySeconds * 1000))
      .expire(key, this.config.security.lockoutDurationMin * 60)
      .exec();
  }

  private backoffKey(email: string, meta: RequestMeta): string {
    return `login:backoff:${sha256(email.toLowerCase())}:${meta.ipAddress ?? 'unknown'}`;
  }
}
