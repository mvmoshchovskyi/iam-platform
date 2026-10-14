import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AuditAction } from '../../audit/audit-action';
import { PaginatedDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AdminSessionDto } from '../../sessions/dto/session.dto';

const ACTIONS = Object.values(AuditAction);

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Subject or actor user id' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: ACTIONS })
  @IsOptional()
  @IsIn(ACTIONS)
  action?: AuditAction;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class AuditUserRefDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() email: string;
}

export class AuditLogDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ACTIONS }) action: string;
  @ApiPropertyOptional({ type: AuditUserRefDto, nullable: true }) user: AuditUserRefDto | null;
  @ApiPropertyOptional({ type: AuditUserRefDto, nullable: true }) actor: AuditUserRefDto | null;
  @ApiPropertyOptional({ nullable: true }) resource: string | null;
  @ApiPropertyOptional({ nullable: true }) resourceId: string | null;
  @ApiPropertyOptional({ nullable: true }) ipAddress: string | null;
  @ApiPropertyOptional({ nullable: true }) userAgent: string | null;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true })
  metadata: unknown;
  @ApiProperty() createdAt: Date;
}

export class PaginatedAuditLogsDto extends PaginatedDto(AuditLogDto) {}

export class AdminSessionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class PaginatedAdminSessionsDto extends PaginatedDto(AdminSessionDto) {}
