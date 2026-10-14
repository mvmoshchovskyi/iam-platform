import { BadRequestException, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import { randomToken, sha256 } from '../common/utils/crypto.util';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { RevokeReason, TokenService } from '../tokens/token.service';
import { displayName } from '../users/email-verification.service';
import type {
  ChangePasswordDto,
  ChangePasswordResponseDto,
  ResetPasswordDto,
} from './dto/password.dto';
import { PasswordPolicyService } from './password-policy.service';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, a reset link has been sent.';

@Injectable()
export class PasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PasswordPolicyService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly config: AppConfigService,
  ) {}

  async changePassword(
    authUser: AuthUser,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ): Promise<ChangePasswordResponseDto> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: authUser.id } });
    if (!(await this.policy.compare(dto.currentPassword, user.passwordHash))) {
      // 400 rather than 401 so clients don't mistake it for an expired session
      throw new BadRequestException({
        message: 'Current password is incorrect',
        code: 'INVALID_PASSWORD',
      });
    }

    await this.validateNewPassword(user, dto.newPassword);
    await this.writePassword(user, dto.newPassword);

    // Keep the session that made the change; sign out everywhere else
    const revokedSessions = this.config.security.revokeSessionsOnPasswordChange
      ? await this.tokens.revokeAllForUser(
          user.id,
          RevokeReason.PASSWORD_CHANGED,
          authUser.sessionId,
        )
      : 0;

    await this.notify(user, AuditAction.PASSWORD_CHANGED, meta, { revokedSessions });
    return { message: 'Password changed', revokedSessions };
  }

  /** Always resolves with the same message to avoid account enumeration. */
  async forgotPassword(email: string, meta: RequestMeta): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return { message: FORGOT_PASSWORD_MESSAGE };

    const token = randomToken();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      }),
    ]);

    await this.mail.send('reset-password', {
      to: user.email,
      name: displayName(user),
      url: `${this.config.app.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`,
    });
    await this.audit.log({ action: AuditAction.PASSWORD_RESET_REQUESTED, userId: user.id, meta });
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto, meta: RequestMeta): Promise<{ message: string }> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: sha256(dto.token) },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date() || !record.user.isActive) {
      throw new BadRequestException({
        message: 'Reset link is invalid or has expired',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    const { user } = record;
    // Validate before claiming so a rejected password doesn't burn the link
    await this.validateNewPassword(user, dto.newPassword);

    // Single use: claim the token atomically before changing anything
    const { count } = await this.prisma.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count !== 1) {
      throw new BadRequestException({
        message: 'Reset link is invalid or has expired',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    await this.writePassword(user, dto.newPassword, {
      // Following an emailed link proves mailbox ownership, and a reset ends any lockout
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      ...(user.lockedUntil && user.lockedUntil > new Date() && { lockedUntil: new Date() }),
    });

    const revokedSessions = this.config.security.revokeSessionsOnPasswordChange
      ? await this.tokens.revokeAllForUser(user.id, RevokeReason.PASSWORD_CHANGED)
      : 0;

    await this.notify(user, AuditAction.PASSWORD_RESET, meta, { revokedSessions });
    return { message: 'Password has been reset. You can now sign in.' };
  }

  private async validateNewPassword(user: User, password: string): Promise<void> {
    this.policy.assertStrong(password, [user.email, user.firstName, user.lastName]);
    await this.policy.assertNotReused(user.id, password);
  }

  private async writePassword(
    user: User,
    password: string,
    extra: Partial<User> = {},
  ): Promise<void> {
    const passwordHash = await this.policy.hash(password);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date(), ...extra },
      });
      await this.policy.recordHistory(tx, user.id, passwordHash);
    });
  }

  private async notify(
    user: User,
    action: typeof AuditAction.PASSWORD_CHANGED | typeof AuditAction.PASSWORD_RESET,
    meta: RequestMeta,
    metadata: { revokedSessions: number },
  ): Promise<void> {
    await this.audit.log({ action, userId: user.id, meta, metadata });
    await this.mail.send('password-changed', {
      to: user.email,
      name: displayName(user),
      time: new Date().toUTCString(),
    });
  }
}
