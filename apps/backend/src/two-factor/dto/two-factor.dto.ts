import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsJWT, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class TotpCodeDto {
  @ApiProperty({ example: '123456', description: '6-digit code from the authenticator app' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}

export class DisableTwoFactorDto {
  @ApiProperty({ description: 'Current account password' })
  @IsString()
  @Length(1, 128)
  password: string;
}

export class VerifyTwoFactorDto {
  @ApiProperty({ description: 'twoFactorToken returned by POST /auth/login' })
  @IsJWT()
  twoFactorToken: string;

  @ApiPropertyOptional({
    example: '123456',
    description: 'TOTP code (provide this or recoveryCode)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code?: string;

  @ApiPropertyOptional({ example: 'a1b2c-d3e4f', description: 'One-time recovery code' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  recoveryCode?: string;
}

export class TwoFactorSetupDto {
  @ApiProperty({
    example: 'otpauth://totp/IAM%20Platform:jane%40example.com?secret=...&issuer=IAM%20Platform',
  })
  otpauthUrl: string;

  @ApiProperty({
    description: 'PNG QR code as a data URL — scan with Google/Microsoft Authenticator',
  })
  qrCodeDataUrl: string;

  @ApiProperty({ description: 'Base32 secret for manual entry' })
  secret: string;
}

export class RecoveryCodesDto {
  @ApiProperty({ example: ['a1b2c-d3e4f'], description: 'Shown once — store them safely' })
  recoveryCodes: string[];
}
