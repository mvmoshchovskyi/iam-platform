import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { RefreshToken } from '@prisma/client';
import type Redis from 'ioredis';
import { type DeepMockProxy, mock, mockDeep, type MockProxy } from 'jest-mock-extended';
import type { AuditService } from '../audit/audit.service';
import { sha256 } from '../common/utils/crypto.util';
import type { PrismaService } from '../database/prisma.service';
import { meta, testConfig, wireTransactions } from '../test-utils/mocks';
import { RevokeReason, TokenService } from './token.service';

describe('TokenService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let redis: MockProxy<Redis>;
  let audit: MockProxy<AuditService>;
  let service: TokenService;
  const jwt = new JwtService();

  const issue = async () => {
    prisma.refreshToken.create.mockResolvedValueOnce({} as RefreshToken);
    const session = await service.issueSession('user-1', meta, { rememberMe: false });
    const stored = prisma.refreshToken.create.mock.calls[0][0].data as RefreshToken;
    return { session, stored: { ...stored, revokedAt: null, revokedReason: null } as RefreshToken };
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    wireTransactions(prisma);
    redis = mock<Redis>();
    audit = mock<AuditService>();
    service = new TokenService(jwt, testConfig(), prisma, audit, redis);
  });

  it('stores only the SHA-256 hash of the refresh token', async () => {
    const { session, stored } = await issue();
    expect(stored.tokenHash).toBe(sha256(session.refreshToken));
    expect(JSON.stringify(stored)).not.toContain(session.refreshToken);
    expect(stored.familyId).toBe(session.sessionId);
  });

  it('signs access tokens with iss, aud, sub, jti and session id', async () => {
    const { session } = await issue();
    const payload = jwt.decode<Record<string, unknown>>(session.accessToken);
    expect(payload).toMatchObject({
      sub: 'user-1',
      typ: 'access',
      sid: session.sessionId,
      iss: 'iam-platform',
      aud: 'iam-platform-web',
    });
    expect(payload.jti).toEqual(expect.any(String));
  });

  it('rotates: revokes the old token and issues a successor in the same family', async () => {
    const { session, stored } = await issue();
    prisma.refreshToken.findUnique.mockResolvedValue(stored);
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const rotated = await service.rotate(session.refreshToken, meta);

    expect(rotated.refreshToken).not.toBe(session.refreshToken);
    expect(rotated.sessionId).toBe(stored.familyId);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: stored.id, revokedAt: null },
        data: expect.objectContaining({ revokedReason: RevokeReason.ROTATED }),
      }),
    );
    const successor = prisma.refreshToken.create.mock.calls[1][0].data;
    expect(successor).toMatchObject({
      familyId: stored.familyId,
      tokenHash: sha256(rotated.refreshToken),
    });
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const { session, stored } = await issue();
    prisma.refreshToken.findUnique.mockResolvedValue({
      ...stored,
      revokedAt: new Date(),
      revokedReason: RevokeReason.ROTATED,
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.rotate(session.refreshToken, meta)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REFRESH_TOKEN_REUSED' }),
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: stored.familyId, revokedAt: null },
        data: expect.objectContaining({ revokedReason: RevokeReason.REUSE_DETECTED }),
      }),
    );
    expect(redis.set).toHaveBeenCalledWith(`session:revoked:${stored.familyId}`, '1', 'EX', 900);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TOKEN_REUSE_DETECTED' }),
    );
  });

  it('treats a lost race (concurrent rotation) as reuse', async () => {
    const { session, stored } = await issue();
    prisma.refreshToken.findUnique.mockResolvedValue(stored);
    prisma.refreshToken.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValue({ count: 1 });

    await expect(service.rotate(session.refreshToken, meta)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TOKEN_REUSE_DETECTED' }),
    );
  });

  it('rejects tokens with an invalid signature without querying the database', async () => {
    const forged = await jwt.signAsync(
      { typ: 'refresh' },
      { secret: 'attacker-secret-attacker-secret!!' },
    );
    await expect(service.rotate(forged, meta)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
  });

  it('round-trips 2FA challenge tokens and rejects access tokens used as challenges', async () => {
    const challenge = await service.signTwoFactorChallenge('user-1', true);
    await expect(service.verifyTwoFactorChallenge(challenge)).resolves.toMatchObject({
      sub: 'user-1',
      rme: true,
    });

    const { session } = await issue();
    await expect(service.verifyTwoFactorChallenge(session.accessToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
