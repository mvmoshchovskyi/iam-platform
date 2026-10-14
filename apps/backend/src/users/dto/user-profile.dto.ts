import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'jane@example.com' }) email: string;
  @ApiPropertyOptional({ nullable: true, example: 'Jane' }) firstName: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'Doe' }) lastName: string | null;
  @ApiProperty() emailVerified: boolean;
  @ApiPropertyOptional({ nullable: true, description: 'Email change awaiting confirmation' })
  pendingEmail: string | null;
  @ApiProperty() twoFactorEnabled: boolean;
  @ApiProperty() isActive: boolean;
  @ApiPropertyOptional({ nullable: true }) lockedUntil: Date | null;
  @ApiPropertyOptional({ nullable: true }) lastLoginAt: Date | null;
  @ApiPropertyOptional({ nullable: true }) lastLoginIp: string | null;
  @ApiPropertyOptional({ nullable: true }) passwordChangedAt: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ example: ['USER'] }) roles: string[];
  @ApiProperty({ example: ['users:read'] }) permissions: string[];
}
