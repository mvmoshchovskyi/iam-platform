import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from '../../common/transformers';

export class LoginDto {
  @ApiProperty({ example: 'admin@iam.local' })
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Admin-Passw0rd!2026' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Extends the refresh token lifetime to 30 days',
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
