import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  currentPassword: string;

  @ApiProperty({ minLength: 10, maxLength: 72, example: 'new-Violet-tractor-77' })
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  newPassword: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token from the reset email link' })
  @IsString()
  @Length(20, 128)
  token: string;

  @ApiProperty({ minLength: 10, maxLength: 72, example: 'new-Violet-tractor-77' })
  @IsString()
  @MinLength(10)
  @MaxLength(72)
  newPassword: string;
}

export class ChangePasswordResponseDto {
  @ApiProperty({ example: 'Password changed' })
  message: string;

  @ApiProperty({ example: 2, description: 'Other sessions signed out by the change' })
  revokedSessions: number;
}
