import { Injectable, Logger } from '@nestjs/common';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { PrismaService } from '../database/prisma.service';
import { PasswordPolicyService } from '../password/password-policy.service';
import { SystemRole } from '../rbac/rbac.constants';
import { EmailVerificationService } from '../users/email-verification.service';
import { UsersService } from '../users/users.service';
import type { RegisterDto } from './dto/register.dto';

export const REGISTER_MESSAGE =
  'Registration received. If the email can be used, a confirmation link has been sent to it.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordPolicyService,
    private readonly emailVerification: EmailVerificationService,
    private readonly audit: AuditService,
  ) {}

  // ─── Registration ─────────────────────────────────────────────────

  /**
   * Creates an unverified account. The response is identical whether or not the email is
   * already registered, so the endpoint cannot be used to enumerate accounts.
   */
  async register(dto: RegisterDto, meta: RequestMeta): Promise<{ message: string }> {
    this.passwords.assertStrong(dto.password, [dto.email, dto.firstName, dto.lastName]);

    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      if (!existing.emailVerifiedAt)
        await this.emailVerification.createAndSend(existing, existing.email, false);
      this.logger.log({ userId: existing.id }, 'Registration attempted for existing email');
      return { message: REGISTER_MESSAGE };
    }

    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordChangedAt: new Date(),
        passwordHistory: { create: { passwordHash } },
        roles: { create: { role: { connect: { name: SystemRole.USER } } } },
      },
    });

    await this.emailVerification.createAndSend(user, user.email, false);
    await this.audit.log({
      action: AuditAction.USER_REGISTERED,
      userId: user.id,
      resource: 'user',
      resourceId: user.id,
      meta,
    });
    return { message: REGISTER_MESSAGE };
  }

  verifyEmail(token: string, meta: RequestMeta) {
    return this.emailVerification.verify(token, meta);
  }

  /** Always succeeds from the caller's perspective (no account enumeration). */
  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.users.findByEmail(email);
    if (user && !user.emailVerifiedAt && user.isActive) {
      await this.emailVerification.createAndSend(user, user.email, false);
    }
    return {
      message: 'If the account exists and is unverified, a new confirmation link has been sent.',
    };
  }
}
