import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionDto {
  @ApiProperty({ format: 'uuid', description: 'Session id (refresh token family)' })
  id: string;

  @ApiProperty({ example: 'Chrome 140 on Windows 10' })
  device: string;

  @ApiPropertyOptional({ nullable: true }) ipAddress: string | null;
  @ApiPropertyOptional({ nullable: true }) userAgent: string | null;

  @ApiProperty({ description: 'When the user signed in' })
  createdAt: Date;

  @ApiProperty({ description: 'Last token refresh' })
  lastActiveAt: Date;

  @ApiProperty() expiresAt: Date;
  @ApiProperty() rememberMe: boolean;

  @ApiProperty({ description: 'True for the session making this request' })
  current: boolean;
}

export class SessionUserDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() email: string;
}

export class AdminSessionDto extends SessionDto {
  @ApiProperty({ type: SessionUserDto })
  user: SessionUserDto;
}

export class RevokedSessionsDto {
  @ApiProperty({ example: 2 })
  revokedSessions: number;
}
