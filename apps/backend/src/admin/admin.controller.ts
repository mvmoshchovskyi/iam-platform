import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiProblem } from '../common/decorators/api-problem.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/types/auth-user';
import { getRequestMeta } from '../common/utils/request-meta.util';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { Roles } from '../rbac/decorators/roles.decorator';
import { Permission, SystemRole } from '../rbac/rbac.constants';
import { SessionsService } from '../sessions/sessions.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminRolesService } from './admin-roles.service';
import { AdminUsersService } from './admin-users.service';
import {
  AdminSessionsQueryDto,
  AuditLogQueryDto,
  PaginatedAdminSessionsDto,
  PaginatedAuditLogsDto,
} from './dto/admin-audit.dto';
import {
  CreateRoleDto,
  PermissionDto,
  RoleDto,
  UpdateRolePermissionsDto,
} from './dto/admin-roles.dto';
import {
  AdminUserDto,
  AdminUsersQueryDto,
  PaginatedAdminUsersDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/admin-users.dto';

/** Every route requires an admin role (RolesGuard) AND a specific permission (PermissionsGuard). */
@ApiTags('Admin')
@ApiBearerAuth('access-token')
@ApiProblem(401, 403)
@Roles(SystemRole.ADMIN, SystemRole.SUPER_ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly roles: AdminRolesService,
    private readonly audit: AdminAuditService,
    private readonly sessions: SessionsService,
  ) {}

  // ─── Users ────────────────────────────────────────────────────────

  @Get('users')
  @Permissions(Permission.USERS_READ)
  @ApiOperation({ summary: 'Paginated user list with search, role and status filters' })
  @ApiOkResponse({ type: PaginatedAdminUsersDto })
  listUsers(@Query() query: AdminUsersQueryDto) {
    return this.users.list(query);
  }

  @Get('users/:id')
  @Permissions(Permission.USERS_READ)
  @ApiOperation({ summary: 'User details' })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiProblem(404)
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Patch('users/:id/role')
  @Permissions(Permission.USERS_WRITE)
  @ApiOperation({ summary: 'Assign or remove a role' })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiProblem(400, 404)
  updateUserRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @Req() req: Request,
  ) {
    return this.users.updateRole(actor, id, dto, getRequestMeta(req));
  }

  @Patch('users/:id/status')
  @Permissions(Permission.USERS_WRITE)
  @ApiOperation({ summary: 'Enable/disable an account or clear a lockout' })
  @ApiOkResponse({ type: AdminUserDto })
  @ApiProblem(400, 404)
  updateUserStatus(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ) {
    return this.users.updateStatus(actor, id, dto, getRequestMeta(req));
  }

  // ─── Roles & permissions ──────────────────────────────────────────

  @Get('roles')
  @Permissions(Permission.ROLES_READ)
  @ApiOperation({ summary: 'List roles with their permissions and user counts' })
  @ApiOkResponse({ type: [RoleDto] })
  listRoles() {
    return this.roles.list();
  }

  @Get('permissions')
  @Permissions(Permission.ROLES_READ)
  @ApiOperation({ summary: 'List all permissions' })
  @ApiOkResponse({ type: [PermissionDto] })
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Post('roles')
  @Permissions(Permission.ROLES_WRITE)
  @ApiOperation({ summary: 'Create a custom role' })
  @ApiCreatedResponse({ type: RoleDto })
  @ApiProblem(400, 409)
  createRole(@CurrentUser() actor: AuthUser, @Body() dto: CreateRoleDto, @Req() req: Request) {
    return this.roles.create(actor, dto, getRequestMeta(req));
  }

  @Patch('roles/:id/permissions')
  @Permissions(Permission.ROLES_WRITE)
  @ApiOperation({ summary: "Replace a role's permissions" })
  @ApiOkResponse({ type: RoleDto })
  @ApiProblem(400, 404)
  updateRolePermissions(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @Req() req: Request,
  ) {
    return this.roles.updatePermissions(actor, id, dto.permissions, getRequestMeta(req));
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(Permission.ROLES_WRITE)
  @ApiOperation({ summary: 'Delete a custom role (system roles are protected)' })
  @ApiNoContentResponse()
  @ApiProblem(400, 404)
  deleteRole(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.roles.delete(actor, id, getRequestMeta(req));
  }

  // ─── Audit & sessions ─────────────────────────────────────────────

  @Get('audit-logs')
  @Permissions(Permission.AUDIT_READ)
  @ApiOperation({ summary: 'Paginated audit log filtered by user, action and date range' })
  @ApiOkResponse({ type: PaginatedAuditLogsDto })
  listAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.audit.list(query);
  }

  @Get('sessions')
  @Permissions(Permission.SESSIONS_READ)
  @ApiOperation({ summary: 'All active sessions across users' })
  @ApiOkResponse({ type: PaginatedAdminSessionsDto })
  listSessions(@Query() query: AdminSessionsQueryDto) {
    return this.sessions.listAll(query);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(Permission.SESSIONS_WRITE)
  @ApiOperation({ summary: "Revoke any user's session" })
  @ApiNoContentResponse()
  @ApiProblem(404)
  revokeSession(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.sessions.revokeAny(actor, id, getRequestMeta(req));
  }
}
