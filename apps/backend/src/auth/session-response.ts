import type { Response } from 'express';
import type { AuthCookieService } from '../tokens/auth-cookie.service';
import type { IssuedSession } from '../tokens/token.service';
import type { UserProfileDto } from '../users/dto/user-profile.dto';
import type { AuthResponseDto } from './dto/auth-response.dto';

export interface SessionResult {
  session: IssuedSession;
  user: UserProfileDto;
}

/** Sets the refresh/CSRF cookies and returns the body — the raw refresh token never hits JSON. */
export const sendSession = (
  cookies: AuthCookieService,
  res: Response,
  result: SessionResult,
): AuthResponseDto => {
  cookies.setSessionCookies(res, result.session.refreshToken, result.session.refreshExpiresAt);
  return {
    requiresTwoFactor: false,
    accessToken: result.session.accessToken,
    tokenType: 'Bearer',
    expiresIn: result.session.expiresIn,
    user: result.user,
  };
};
