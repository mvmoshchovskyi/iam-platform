import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditAction } from '../audit/audit-action';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../common/types/auth-user';
import type { RequestMeta } from '../common/utils/request-meta.util';
import { PrismaService } from '../database/prisma.service';
import { type Permission, SystemRole } from '../rbac/rbac.constants';
import type { CreateRoleDto, PermissionDto, RoleDto } from './dto/admin-roles.dto';

const roleInclude = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

type RoleWithPermissions = Prisma.RoleGetPayload<{ include: typeof roleInclude }>;

const toRoleDto = (role: RoleWithPermissions): RoleDto => ({
  id: role.id,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  permissions: role.permissions.map((rp) => rp.permission.key).sort(),
  userCount: role._count.users,
  createdAt: role.createdAt,
});

@Injectable()
export class AdminRolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({
      include: roleInclude,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map(toRoleDto);
  }

  listPermissions(): Promise<PermissionDto[]> {
    return this.prisma.permission.findMany({
      select: { id: true, key: true, description: true },
      orderBy: { key: 'asc' },
    });
  }

  async create(actor: AuthUser, dto: CreateRoleDto, meta: RequestMeta): Promise<RoleDto> {
    if (await this.prisma.role.findUnique({ where: { name: dto.name }, select: { id: true } })) {
      throw new ConflictException({
        message: `Role ${dto.name} already exists`,
        code: 'ROLE_EXISTS',
      });
    }
    const permissionIds = await this.permissionIds(dto.permissions ?? []);
    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        permissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
      include: roleInclude,
    });
    await this.audit.log({
      action: AuditAction.ROLE_CREATED,
      actorId: actor.id,
      resource: 'role',
      resourceId: role.id,
      meta,
      metadata: { name: role.name, permissions: dto.permissions ?? [] },
    });
    return toRoleDto(role);
  }

  async updatePermissions(
    actor: AuthUser,
    id: string,
    permissions: Permission[],
    meta: RequestMeta,
  ): Promise<RoleDto> {
    const role = await this.findOrThrow(id);
    if (role.name === SystemRole.SUPER_ADMIN) {
      throw new BadRequestException({
        message: 'SUPER_ADMIN always has every permission',
        code: 'SYSTEM_ROLE',
      });
    }
    const permissionIds = await this.permissionIds(permissions);
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      });
      return tx.role.findUniqueOrThrow({ where: { id }, include: roleInclude });
    });
    await this.audit.log({
      action: AuditAction.ROLE_UPDATED,
      actorId: actor.id,
      resource: 'role',
      resourceId: id,
      meta,
      metadata: { name: role.name, permissions },
    });
    return toRoleDto(updated);
  }

  async delete(actor: AuthUser, id: string, meta: RequestMeta): Promise<void> {
    const role = await this.findOrThrow(id);
    if (role.isSystem) {
      throw new BadRequestException({
        message: 'System roles cannot be deleted',
        code: 'SYSTEM_ROLE',
      });
    }
    await this.prisma.role.delete({ where: { id } });
    await this.audit.log({
      action: AuditAction.ROLE_DELETED,
      actorId: actor.id,
      resource: 'role',
      resourceId: id,
      meta,
      metadata: { name: role.name },
    });
  }

  private async findOrThrow(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException({ message: 'Role not found', code: 'ROLE_NOT_FOUND' });
    return role;
  }

  private async permissionIds(keys: Permission[]): Promise<string[]> {
    if (!keys.length) return [];
    const found = await this.prisma.permission.findMany({
      where: { key: { in: keys } },
      select: { id: true },
    });
    return found.map((p) => p.id);
  }
}
