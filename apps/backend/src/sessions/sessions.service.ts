import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, RefreshToken } from '@prisma/client';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import { type Paginated, paginate, type PaginationQueryDto } from '../common/dto/pagination.dto';
import type { AuthUser } from '../common/types/auth-user';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { describeDevice } from '../common/utils/user-agent.util';
import { PrismaService } from '../database/prisma.service';
import { RevokeReason, TokenService } from '../tokens/token.service';
import type { AdminSessionDto, SessionDto } from './dto/session.dto';

/** Each family has exactly one live token, so "active sessions" = live refresh tokens. */
const activeWhere = (): Prisma.RefreshTokenWhereInput => ({
  revokedAt: null,
  expiresAt: { gt: new Date() },
});

const toSessionDto = (token: RefreshToken, currentSessionId?: string): SessionDto => ({
  id: token.familyId,
  device: describeDevice(token.userAgent),
  ipAddress: token.ipAddress,
  userAgent: token.userAgent,
  createdAt: token.sessionStartedAt,
  lastActiveAt: token.createdAt,
  expiresAt: token.expiresAt,
  rememberMe: token.rememberMe,
  current: token.familyId === currentSessionId,
});

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async listForUser(user: AuthUser): Promise<SessionDto[]> {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId: user.id, ...activeWhere() },
      orderBy: { createdAt: 'desc' },
    });
    return tokens
      .map((t) => toSessionDto(t, user.sessionId))
      .sort((a, b) => Number(b.current) - Number(a.current));
  }

  async revokeOwn(user: AuthUser, sessionId: string, meta: RequestMeta): Promise<void> {
    const owned = await this.prisma.refreshToken.findFirst({
      where: { familyId: sessionId, userId: user.id, ...activeWhere() },
      select: { id: true },
    });
    if (!owned)
      throw new NotFoundException({ message: 'Session not found', code: 'SESSION_NOT_FOUND' });
    await this.revoke(sessionId, user.id, user.id, meta);
  }

  async revokeOthers(user: AuthUser, meta: RequestMeta): Promise<{ revokedSessions: number }> {
    const revokedSessions = await this.tokens.revokeAllForUser(
      user.id,
      RevokeReason.SESSION_REVOKED,
      user.sessionId,
    );
    await this.audit.log({
      action: AuditAction.SESSION_REVOKED,
      userId: user.id,
      meta,
      metadata: { scope: 'others', revokedSessions },
    });
    return { revokedSessions };
  }

  // ─── Admin ────────────────────────────────────────────────────────

  async listAll(
    query: PaginationQueryDto & { userId?: string },
  ): Promise<Paginated<AdminSessionDto>> {
    const where: Prisma.RefreshTokenWhereInput = {
      ...activeWhere(),
      ...(query.userId && { userId: query.userId }),
    };
    const [tokens, total] = await this.prisma.$transaction([
      this.prisma.refreshToken.findMany({
        where,
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.refreshToken.count({ where }),
    ]);
    return paginate(
      tokens.map((t) => ({ ...toSessionDto(t), user: t.user })),
      total,
      query,
    );
  }

  async revokeAny(actor: AuthUser, sessionId: string, meta: RequestMeta): Promise<void> {
    const token = await this.prisma.refreshToken.findFirst({
      where: { familyId: sessionId, ...activeWhere() },
      select: { userId: true },
    });
    if (!token)
      throw new NotFoundException({ message: 'Session not found', code: 'SESSION_NOT_FOUND' });
    await this.revoke(sessionId, token.userId, actor.id, meta);
  }

  private async revoke(
    sessionId: string,
    userId: string,
    actorId: string,
    meta: RequestMeta,
  ): Promise<void> {
    await this.tokens.revokeFamily(
      sessionId,
      actorId === userId ? RevokeReason.SESSION_REVOKED : RevokeReason.ADMIN,
    );
    await this.audit.log({
      action: AuditAction.SESSION_REVOKED,
      userId,
      actorId,
      resource: 'session',
      resourceId: sessionId,
      meta,
    });
  }
}
