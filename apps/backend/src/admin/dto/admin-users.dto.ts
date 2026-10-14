import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginatedDto, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Trim } from '../../common/transformers';
import { UserProfileDto } from '../../users/dto/user-profile.dto';

export const USER_STATUSES = ['active', 'disabled', 'locked', 'unverified'] as const;
export const USER_SORT_FIELDS = ['createdAt', 'email', 'lastLoginAt'] as const;

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches email, first or last name' })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ example: 'ADMIN', description: 'Role name' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: (typeof USER_STATUSES)[number];

  @ApiPropertyOptional({ enum: USER_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy: (typeof USER_SORT_FIELDS)[number] = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}

export class AdminUserDto extends UserProfileDto {
  @ApiProperty({ example: 2 })
  activeSessions: number;
}

export class PaginatedAdminUsersDto extends PaginatedDto(AdminUserDto) {}

export class UpdateUserRoleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  roleId: string;

  @ApiProperty({ enum: ['assign', 'remove'] })
  @IsIn(['assign', 'remove'])
  action: 'assign' | 'remove';
}

export class UpdateUserStatusDto {
  @ApiPropertyOptional({
    description: 'Enable/disable the account (disabling revokes all sessions)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Clear an active lockout' })
  @IsOptional()
  @IsBoolean()
  unlock?: boolean;
}
