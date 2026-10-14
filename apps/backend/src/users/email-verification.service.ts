import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import { randomToken, sha256 } from '../common/utils/crypto.util';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const displayName = (user: Pick<User, 'firstName' | 'email'>) =>
  user.firstName ?? user.email.split('@')[0];

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Issues a single-use token (only its hash is stored) and queues the confirmation email. */
  async createAndSend(user: User, email: string, isEmailChange: boolean): Promise<void> {
    const token = randomToken();
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          email,
          tokenHash: sha256(token),
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        },
      }),
    ]);

    await this.mail.send('verify-email', {
      to: email,
      name: displayName(user),
      url: `${this.config.app.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`,
      isEmailChange,
    });
  }

  async verify(token: string, meta: RequestMeta): Promise<{ email: string }> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: sha256(token) },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException({
        message: 'Verification link is invalid or has expired',
        code: 'INVALID_VERIFICATION_TOKEN',
      });
    }

    const { user } = record;
    const isEmailChange = record.email !== user.email;
    if (isEmailChange) {
      if (record.email !== user.pendingEmail) {
        throw new BadRequestException({
          message: 'This email change was cancelled',
          code: 'INVALID_VERIFICATION_TOKEN',
        });
      }
      const taken = await this.prisma.user.findUnique({
        where: { email: record.email },
        select: { id: true },
      });
      if (taken)
        throw new ConflictException({ message: 'Email is already in use', code: 'EMAIL_TAKEN' });
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: isEmailChange
          ? { email: record.email, pendingEmail: null, emailVerifiedAt: new Date() }
          : { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      }),
    ]);

    await this.audit.log({
      action: AuditAction.EMAIL_VERIFIED,
      userId: user.id,
      meta,
      metadata: { email: record.email, emailChange: isEmailChange },
    });
    return { email: record.email };
  }
}
