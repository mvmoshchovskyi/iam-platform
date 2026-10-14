import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/transformers';
import { Permission } from '../../rbac/rbac.constants';

const PERMISSION_KEYS = Object.values(Permission);

export class PermissionDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'users:read' }) key: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
}

export class RoleDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'AUDITOR' }) name: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty() isSystem: boolean;
  @ApiProperty({ example: ['audit:read'] }) permissions: string[];
  @ApiProperty({ example: 3 }) userCount: number;
  @ApiProperty() createdAt: Date;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'AUDITOR', description: 'UPPER_SNAKE_CASE' })
  @Trim()
  @Matches(/^[A-Z][A-Z0-9_]{2,49}$/, { message: 'name must be UPPER_SNAKE_CASE (3-50 chars)' })
  name: string;

  @ApiPropertyOptional({ example: 'Read-only access to audit logs' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({ enum: PERMISSION_KEYS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_KEYS, { each: true })
  permissions?: Permission[];
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ enum: PERMISSION_KEYS, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_KEYS, { each: true })
  permissions: Permission[];
}
