import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { PrismaService } from '../database/prisma.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import type { UserProfileDto } from './dto/user-profile.dto';
import { EmailVerificationService } from './email-verification.service';
import { flattenAccess, type UserWithAccess, userWithAccessInclude } from './users.types';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailVerification: EmailVerificationService,
    private readonly audit: AuditService,
  ) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findAuthContext(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userWithAccessInclude,
    });
    return user ? { user, ...flattenAccess(user) } : null;
  }

  async getProfile(id: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userWithAccessInclude,
    });
    if (!user) throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    return this.toProfile(user);
  }

  async updateProfile(
    id: string,
    dto: UpdateProfileDto,
    meta: RequestMeta,
  ): Promise<UserProfileDto> {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const emailChanged = dto.email !== undefined && dto.email !== current.email;

    if (emailChanged) {
      const taken = await this.prisma.user.findFirst({
        where: { id: { not: id }, OR: [{ email: dto.email }, { pendingEmail: dto.email }] },
        select: { id: true },
      });
      if (taken)
        throw new ConflictException({ message: 'Email is already in use', code: 'EMAIL_TAKEN' });
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        ...(emailChanged && { pendingEmail: dto.email }),
        // Re-submitting the current email cancels a pending change
        ...(dto.email === current.email && { pendingEmail: null }),
      },
      include: userWithAccessInclude,
    });

    await this.audit.log({
      action: AuditAction.PROFILE_UPDATED,
      userId: id,
      resource: 'user',
      resourceId: id,
      meta,
      metadata: { fields: Object.keys(dto) },
    });

    if (emailChanged) {
      await this.emailVerification.createAndSend(user, dto.email!, true);
      await this.audit.log({
        action: AuditAction.EMAIL_CHANGE_REQUESTED,
        userId: id,
        meta,
        metadata: { newEmail: dto.email },
      });
    }

    return this.toProfile(user);
  }

  toProfile(user: UserWithAccess): UserProfileDto {
    const { roles, permissions } = flattenAccess(user);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerifiedAt !== null,
      pendingEmail: user.pendingEmail,
      twoFactorEnabled: user.twoFactorEnabled,
      isActive: user.isActive,
      lockedUntil: user.lockedUntil && user.lockedUntil > new Date() ? user.lockedUntil : null,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      passwordChangedAt: user.passwordChangedAt,
      createdAt: user.createdAt,
      roles,
      permissions,
    };
  }
}
