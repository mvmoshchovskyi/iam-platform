import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import { sha256 } from '../common/utils/crypto.util';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TwoFactorChallengePayload,
} from './jwt-payload.interface';

const ALGORITHM = 'HS256' as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export const RevokeReason = {
  ROTATED: 'rotated',
  LOGOUT: 'logout',
  LOGOUT_ALL: 'logout_all',
  REUSE_DETECTED: 'reuse_detected',
  SESSION_REVOKED: 'session_revoked',
  PASSWORD_CHANGED: 'password_changed',
  ADMIN: 'admin',
} as const;
export type RevokeReason = (typeof RevokeReason)[keyof typeof RevokeReason];

export interface IssuedSession {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  sessionId: string;
}

interface SessionOptions {
  rememberMe: boolean;
  familyId?: string;
  sessionStartedAt?: Date;
}

const invalidRefresh = (code = 'INVALID_REFRESH_TOKEN') =>
  new UnauthorizedException({ message: 'Invalid or expired refresh token', code });

/**
 * Issues and validates every token type. Refresh tokens are JWTs signed with their own
 * secret, but only their SHA-256 hash is persisted; rotation is atomic and a replayed
 * (already rotated) token revokes its whole family.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  // ─── Access tokens ────────────────────────────────────────────────

  async signAccessToken(
    userId: string,
    sessionId: string,
  ): Promise<{ token: string; expiresIn: number }> {
    const { accessSecret, accessTtl, issuer, audience } = this.config.jwt;
    const token = await this.jwt.signAsync(
      { typ: 'access', sid: sessionId } satisfies Partial<AccessTokenPayload>,
      {
        secret: accessSecret,
        algorithm: ALGORITHM,
        expiresIn: accessTtl,
        issuer,
        audience,
        subject: userId,
        jwtid: randomUUID(),
      },
    );
    return { token, expiresIn: accessTtl };
  }

  /** Denylists an access token until it expires (used on logout). */
  async denylistAccessToken(jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await this.redis.set(`jwt:deny:${jti}`, '1', 'EX', ttl);
  }

  /**
   * Returns true if the access token was revoked: explicitly denylisted, its session was
   * revoked, or it was issued before a "revoke everything" event for the user.
   */
  async isAccessTokenRevoked(payload: AccessTokenPayload): Promise<boolean> {
    const [denied, sessionRevoked, validAfter] = await this.redis.mget(
      `jwt:deny:${payload.jti}`,
      `session:revoked:${payload.sid}`,
      `user:tokens-valid-after:${payload.sub}`,
    );
    return Boolean(denied || sessionRevoked || (validAfter && payload.iat < Number(validAfter)));
  }

  // ─── Sessions / refresh tokens ────────────────────────────────────

  async issueSession(
    userId: string,
    meta: RequestMeta,
    opts: SessionOptions,
  ): Promise<IssuedSession> {
    const familyId = opts.familyId ?? randomUUID();
    const refresh = await this.buildRefreshToken(userId, familyId, opts.rememberMe);

    await this.prisma.refreshToken.create({
      data: {
        id: refresh.id,
        tokenHash: refresh.hash,
        familyId,
        userId,
        rememberMe: opts.rememberMe,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: refresh.expiresAt,
        sessionStartedAt: opts.sessionStartedAt ?? new Date(),
      },
    });

    const access = await this.signAccessToken(userId, familyId);
    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      sessionId: familyId,
    };
  }

  /** Validates a raw refresh token, revokes it and issues its successor in one transaction. */
  async rotate(rawToken: string, meta: RequestMeta): Promise<IssuedSession & { userId: string }> {
    await this.verifyRefreshJwt(rawToken);

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    if (!record) throw invalidRefresh();

    if (record.revokedAt) {
      if (record.revokedReason === RevokeReason.ROTATED)
        await this.handleReuse(record.familyId, record.userId, meta);
      throw invalidRefresh(
        record.revokedReason === RevokeReason.ROTATED ? 'REFRESH_TOKEN_REUSED' : undefined,
      );
    }
    if (record.expiresAt <= new Date()) throw invalidRefresh();

    const next = await this.buildRefreshToken(record.userId, record.familyId, record.rememberMe);
    const rotated = await this.prisma.$transaction(async (tx) => {
      // Conditional update: if a concurrent request already rotated this token, count is 0
      const { count } = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: RevokeReason.ROTATED, replacedById: next.id },
      });
      if (count !== 1) return false;
      await tx.refreshToken.create({
        data: {
          id: next.id,
          tokenHash: next.hash,
          familyId: record.familyId,
          userId: record.userId,
          rememberMe: record.rememberMe,
          userAgent: meta.userAgent ?? record.userAgent,
          ipAddress: meta.ipAddress ?? record.ipAddress,
          expiresAt: next.expiresAt,
          sessionStartedAt: record.sessionStartedAt,
        },
      });
      return true;
    });

    if (!rotated) {
      await this.handleReuse(record.familyId, record.userId, meta);
      throw invalidRefresh('REFRESH_TOKEN_REUSED');
    }

    const access = await this.signAccessToken(record.userId, record.familyId);
    return {
      userId: record.userId,
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken: next.token,
      refreshExpiresAt: next.expiresAt,
      sessionId: record.familyId,
    };
  }

  /** Looks up the active refresh token record for a raw token (null if unknown/revoked). */
  async findActiveByRawToken(rawToken: string | undefined) {
    if (!rawToken) return null;
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
    });
    return record && !record.revokedAt && record.expiresAt > new Date() ? record : null;
  }

  async revokeFamily(familyId: string, reason: RevokeReason): Promise<number> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    await this.redis.set(`session:revoked:${familyId}`, '1', 'EX', this.config.jwt.accessTtl);
    return count;
  }

  /** Revokes every session of a user, optionally keeping one (e.g. the caller's current session). */
  async revokeAllForUser(
    userId: string,
    reason: RevokeReason,
    exceptFamilyId?: string,
  ): Promise<number> {
    const active = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptFamilyId && { familyId: { not: exceptFamilyId } }),
      },
      select: { familyId: true },
      distinct: ['familyId'],
    });
    for (const { familyId } of active) await this.revokeFamily(familyId, reason);

    if (!exceptFamilyId) {
      // Invalidate already-issued access tokens too, not only refresh tokens
      await this.redis.set(
        `user:tokens-valid-after:${userId}`,
        String(Math.floor(Date.now() / 1000)),
        'EX',
        this.config.jwt.accessTtl,
      );
    }
    return active.length;
  }

  // ─── 2FA challenge tokens ─────────────────────────────────────────

  async signTwoFactorChallenge(userId: string, rememberMe: boolean): Promise<string> {
    const { twoFactorSecret, twoFactorTtl, issuer, audience } = this.config.jwt;
    return this.jwt.signAsync(
      { typ: '2fa', rme: rememberMe } satisfies Partial<TwoFactorChallengePayload>,
      {
        secret: twoFactorSecret,
        algorithm: ALGORITHM,
        expiresIn: twoFactorTtl,
        issuer,
        audience: `${audience}:2fa`,
        subject: userId,
        jwtid: randomUUID(),
      },
    );
  }

  async verifyTwoFactorChallenge(token: string): Promise<TwoFactorChallengePayload> {
    const { twoFactorSecret, issuer, audience } = this.config.jwt;
    try {
      const payload = await this.jwt.verifyAsync<TwoFactorChallengePayload>(token, {
        secret: twoFactorSecret,
        algorithms: [ALGORITHM],
        issuer,
        audience: `${audience}:2fa`,
      });
      if (payload.typ !== '2fa') throw new Error('wrong token type');
      return payload;
    } catch {
      throw new UnauthorizedException({
        message: 'Two-factor session expired, please sign in again',
        code: 'INVALID_2FA_TOKEN',
      });
    }
  }

  // ─── internals ────────────────────────────────────────────────────

  private async buildRefreshToken(userId: string, familyId: string, rememberMe: boolean) {
    const { refreshSecret, refreshTtlDays, refreshRememberTtlDays, issuer, audience } =
      this.config.jwt;
    const days = rememberMe ? refreshRememberTtlDays : refreshTtlDays;
    const id = randomUUID();
    const token = await this.jwt.signAsync(
      { typ: 'refresh', fam: familyId } satisfies Partial<RefreshTokenPayload>,
      {
        secret: refreshSecret,
        algorithm: ALGORITHM,
        expiresIn: days * 24 * 60 * 60,
        issuer,
        audience: `${audience}:refresh`,
        subject: userId,
        jwtid: id,
      },
    );
    return { id, token, hash: sha256(token), expiresAt: new Date(Date.now() + days * DAY_MS) };
  }

  private async verifyRefreshJwt(token: string): Promise<RefreshTokenPayload> {
    const { refreshSecret, issuer, audience } = this.config.jwt;
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: refreshSecret,
        algorithms: [ALGORITHM],
        issuer,
        audience: `${audience}:refresh`,
      });
      if (payload.typ !== 'refresh') throw new Error('wrong token type');
      return payload;
    } catch {
      throw invalidRefresh();
    }
  }

  private async handleReuse(familyId: string, userId: string, meta: RequestMeta): Promise<void> {
    const revoked = await this.revokeFamily(familyId, RevokeReason.REUSE_DETECTED);
    this.logger.warn({ userId, familyId }, 'Refresh token reuse detected — family revoked');
    await this.audit.log({
      action: AuditAction.TOKEN_REUSE_DETECTED,
      userId,
      resource: 'session',
      resourceId: familyId,
      meta,
      metadata: { revokedTokens: revoked },
    });
  }
}
