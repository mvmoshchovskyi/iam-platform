import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserProfileDto } from '../../users/dto/user-profile.dto';

/** Issued on successful sign-in or refresh; the refresh token is set as an HttpOnly cookie. */
export class AuthResponseDto {
  @ApiProperty({ example: false })
  requiresTwoFactor: false;

  @ApiProperty({ description: 'JWT access token (keep in memory only)' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn: number;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}

export class TwoFactorChallengeDto {
  @ApiProperty({ example: true })
  requiresTwoFactor: true;

  @ApiProperty({
    description: 'Short-lived token to submit with the TOTP code to /auth/2fa/verify',
  })
  twoFactorToken: string;
}

/** Union documented as a single schema: check `requiresTwoFactor` first. */
export class LoginResponseDto {
  @ApiProperty() requiresTwoFactor: boolean;
  @ApiPropertyOptional() accessToken?: string;
  @ApiPropertyOptional({ example: 'Bearer' }) tokenType?: 'Bearer';
  @ApiPropertyOptional({ example: 900 }) expiresIn?: number;
  @ApiPropertyOptional({ type: UserProfileDto }) user?: UserProfileDto;
  @ApiPropertyOptional() twoFactorToken?: string;
}
