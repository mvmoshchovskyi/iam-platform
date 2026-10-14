import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import { type Paginated, paginate } from '../common/dto/pagination.dto';
import type { AuthUser } from '../common/types/auth-user';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { PrismaService } from '../database/prisma.service';
import { SystemRole } from '../rbac/rbac.constants';
import { RevokeReason, TokenService } from '../tokens/token.service';
import { UsersService } from '../users/users.service';
import { userWithAccessInclude } from '../users/users.types';
import type {
  AdminUserDto,
  AdminUsersQueryDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/admin-users.dto';

const isSuperAdmin = (roles: string[]) => roles.includes(SystemRole.SUPER_ADMIN);

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AdminUsersQueryDto): Promise<Paginated<AdminUserDto>> {
    const now = new Date();
    const filters: Prisma.UserWhereInput[] = [];
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      filters.push({ OR: [{ email: contains }, { firstName: contains }, { lastName: contains }] });
    }
    if (query.role) filters.push({ roles: { some: { role: { name: query.role } } } });
    switch (query.status) {
      case 'active':
        filters.push({
          isActive: true,
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
        });
        break;
      case 'disabled':
        filters.push({ isActive: false });
        break;
      case 'locked':
        filters.push({ lockedUntil: { gt: now } });
        break;
      case 'unverified':
        filters.push({ emailVerifiedAt: null });
        break;
    }
    const where: Prisma.UserWhereInput = { AND: filters };
    const orderBy: Prisma.UserOrderByWithRelationInput =
      query.sortBy === 'lastLoginAt'
        ? { lastLoginAt: { sort: query.sortOrder, nulls: 'last' } }
        : { [query.sortBy]: query.sortOrder };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: query.skip,
        take: query.limit,
        include: this.listInclude(now),
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(
      users.map((u) => ({ ...this.users.toProfile(u), activeSessions: u._count.refreshTokens })),
      total,
      query,
    );
  }

  async get(id: string): Promise<AdminUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: this.listInclude(new Date()),
    });
    if (!user) throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    return { ...this.users.toProfile(user), activeSessions: user._count.refreshTokens };
  }

  async updateRole(
    actor: AuthUser,
    userId: string,
    dto: UpdateUserRoleDto,
    meta: RequestMeta,
  ): Promise<AdminUserDto> {
    const target = await this.users.findAuthContext(userId);
    if (!target) throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException({ message: 'Role not found', code: 'ROLE_NOT_FOUND' });

    const actorIsSuper = isSuperAdmin(actor.roles);
    if (!actorIsSuper && (role.name === SystemRole.SUPER_ADMIN || isSuperAdmin(target.roles))) {
      throw new ForbiddenException({
        message: 'Only a super admin can manage super admin privileges',
        code: 'SUPER_ADMIN_REQUIRED',
      });
    }

    if (dto.action === 'assign') {
      await this.prisma.userRole.createMany({
        data: [{ userId, roleId: role.id, assignedById: actor.id }],
        skipDuplicates: true,
      });
    } else {
      if (role.name === SystemRole.SUPER_ADMIN) await this.assertCanRemoveSuperAdmin(actor, userId);
      await this.prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
    }

    await this.audit.log({
      action: dto.action === 'assign' ? AuditAction.ROLE_ASSIGNED : AuditAction.ROLE_REMOVED,
      userId,
      actorId: actor.id,
      resource: 'role',
      resourceId: role.id,
      meta,
      metadata: { role: role.name },
    });
    return this.get(userId);
  }

  async updateStatus(
    actor: AuthUser,
    userId: string,
    dto: UpdateUserStatusDto,
    meta: RequestMeta,
  ): Promise<AdminUserDto> {
    const target = await this.users.findAuthContext(userId);
    if (!target) throw new NotFoundException({ message: 'User not found', code: 'USER_NOT_FOUND' });
    if (dto.isActive === false && userId === actor.id) {
      throw new BadRequestException({
        message: 'You cannot disable your own account',
        code: 'CANNOT_DISABLE_SELF',
      });
    }
    if (isSuperAdmin(target.roles) && !isSuperAdmin(actor.roles)) {
      throw new ForbiddenException({
        message: 'Only a super admin can modify a super admin',
        code: 'SUPER_ADMIN_REQUIRED',
      });
    }

    const now = new Date();
    const unlocking =
      dto.unlock === true && target.user.lockedUntil !== null && target.user.lockedUntil > now;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        // Lock expiry set to "now" (not null) so older failures don't immediately re-lock
        ...(unlocking && { lockedUntil: now }),
      },
    });

    if (dto.isActive === false) await this.tokens.revokeAllForUser(userId, RevokeReason.ADMIN);
    if (dto.isActive !== undefined && dto.isActive !== target.user.isActive) {
      await this.audit.log({
        action: AuditAction.USER_STATUS_CHANGED,
        userId,
        actorId: actor.id,
        meta,
        metadata: { isActive: dto.isActive },
      });
    }
    if (unlocking) {
      await this.audit.log({
        action: AuditAction.ACCOUNT_UNLOCKED,
        userId,
        actorId: actor.id,
        meta,
      });
    }
    return this.get(userId);
  }

  private async assertCanRemoveSuperAdmin(actor: AuthUser, userId: string): Promise<void> {
    if (userId === actor.id) {
      throw new BadRequestException({
        message: 'You cannot remove your own super admin role',
        code: 'CANNOT_REMOVE_OWN_SUPER_ADMIN',
      });
    }
    const remaining = await this.prisma.userRole.count({
      where: { role: { name: SystemRole.SUPER_ADMIN } },
    });
    if (remaining <= 1) {
      throw new BadRequestException({
        message: 'At least one super admin must remain',
        code: 'LAST_SUPER_ADMIN',
      });
    }
  }

  private listInclude(now: Date) {
    return {
      ...userWithAccessInclude,
      _count: { select: { refreshTokens: { where: { revokedAt: null, expiresAt: { gt: now } } } } },
    } satisfies Prisma.UserInclude;
  }
}
