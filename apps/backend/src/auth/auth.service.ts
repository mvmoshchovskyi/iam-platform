import { ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { PrismaService } from '../database/prisma.service';
import { PasswordPolicyService } from '../password/password-policy.service';
import { SystemRole } from '../rbac/rbac.constants';
import { RevokeReason, TokenService } from '../tokens/token.service';
import { EmailVerificationService } from '../users/email-verification.service';
import { UsersService } from '../users/users.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { FailureReason, LoginProtectionService } from './login-protection.service';
import type { SessionResult } from './session-response';

export type LoginResult =
  | ({ requiresTwoFactor: false } & SessionResult)
  | { requiresTwoFactor: true; twoFactorToken: string };

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
    private readonly tokens: TokenService,
    private readonly protection: LoginProtectionService,
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

  // ─── Login ────────────────────────────────────────────────────────

  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult> {
    await this.protection.assertNotBackedOff(dto.email, meta);

    const user = await this.users.findByEmail(dto.email);
    if (user) await this.protection.assertNotLocked(user, meta);

    // Always run bcrypt (against a dummy hash if the user doesn't exist) to keep timing uniform
    const passwordOk = await this.passwords.compare(dto.password, user?.passwordHash);
    if (!user || !passwordOk) {
      const lockedUntil = await this.protection.recordFailure(
        user,
        dto.email,
        meta,
        FailureReason.INVALID_CREDENTIALS,
      );
      if (lockedUntil) throw this.protection.lockedException(lockedUntil);
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.isActive) {
      await this.protection.recordAttempt(
        user.id,
        user.email,
        meta,
        FailureReason.ACCOUNT_DISABLED,
      );
      throw new ForbiddenException({
        message: 'This account has been disabled',
        code: 'ACCOUNT_DISABLED',
      });
    }
    if (!user.emailVerifiedAt) {
      await this.protection.recordAttempt(
        user.id,
        user.email,
        meta,
        FailureReason.EMAIL_NOT_VERIFIED,
      );
      throw new ForbiddenException({
        message: 'Please verify your email address before signing in',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const rememberMe = dto.rememberMe ?? false;
    if (user.twoFactorEnabled) {
      return {
        requiresTwoFactor: true,
        twoFactorToken: await this.tokens.signTwoFactorChallenge(user.id, rememberMe),
      };
    }
    return { requiresTwoFactor: false, ...(await this.completeLogin(user.id, meta, rememberMe)) };
  }

  /** Final step of every successful sign-in (password-only or after 2FA). */
  async completeLogin(
    userId: string,
    meta: RequestMeta,
    rememberMe: boolean,
  ): Promise<SessionResult> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const { suspicious } = await this.protection.recordSuccess(user, meta);
    const session = await this.tokens.issueSession(user.id, meta, { rememberMe });

    await this.audit.log({
      action: AuditAction.LOGIN_SUCCESS,
      userId: user.id,
      resource: 'session',
      resourceId: session.sessionId,
      meta,
      metadata: { rememberMe, suspicious, twoFactor: user.twoFactorEnabled },
    });
    return { session, user: await this.users.getProfile(user.id) };
  }

  // ─── Refresh & logout ─────────────────────────────────────────────

  async refresh(rawToken: string, meta: RequestMeta): Promise<SessionResult> {
    const session = await this.tokens.rotate(rawToken, meta);
    const ctx = await this.users.findAuthContext(session.userId);
    if (!ctx?.user.isActive) {
      await this.tokens.revokeFamily(session.sessionId, RevokeReason.ADMIN);
      throw new UnauthorizedException({
        message: 'Account is not available',
        code: 'ACCOUNT_UNAVAILABLE',
      });
    }
    return { session, user: this.users.toProfile(ctx.user) };
  }

  /** Revokes the session identified by the refresh cookie. Idempotent. */
  async logout(rawToken: string | undefined, meta: RequestMeta): Promise<void> {
    const record = await this.tokens.findActiveByRawToken(rawToken);
    if (!record) return;
    await this.tokens.revokeFamily(record.familyId, RevokeReason.LOGOUT);
    await this.audit.log({
      action: AuditAction.LOGOUT,
      userId: record.userId,
      resource: 'session',
      resourceId: record.familyId,
      meta,
    });
  }

  async logoutAll(userId: string, meta: RequestMeta): Promise<{ revokedSessions: number }> {
    const revokedSessions = await this.tokens.revokeAllForUser(userId, RevokeReason.LOGOUT_ALL);
    await this.audit.log({
      action: AuditAction.LOGOUT_ALL,
      userId,
      meta,
      metadata: { revokedSessions },
    });
    return { revokedSessions };
  }
}
