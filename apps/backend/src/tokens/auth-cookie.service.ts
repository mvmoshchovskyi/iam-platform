import { Injectable } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { randomToken } from '../common/utils/crypto.util';
import { AppConfigService } from '../config/app-config.service';

export const REFRESH_COOKIE = 'refresh_token';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Refresh token travels only in an HttpOnly, SameSite=Strict cookie scoped to the API.
 * A readable CSRF cookie implements the double-submit pattern: the SPA echoes it back in
 * the X-CSRF-Token header on cookie-authenticated endpoints.
 */
@Injectable()
export class AuthCookieService {
  constructor(private readonly config: AppConfigService) {}

  setSessionCookies(res: Response, refreshToken: string, expiresAt: Date): void {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.base(),
      httpOnly: true,
      path: this.apiPath(),
      expires: expiresAt,
    });
    res.cookie(CSRF_COOKIE, randomToken(24), {
      ...this.base(),
      httpOnly: false,
      path: '/',
      expires: expiresAt,
    });
  }

  clearSessionCookies(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { ...this.base(), httpOnly: true, path: this.apiPath() });
    res.clearCookie(CSRF_COOKIE, { ...this.base(), httpOnly: false, path: '/' });
  }

  getRefreshToken(req: Request): string | undefined {
    const value = (req.cookies as Record<string, string | undefined> | undefined)?.[REFRESH_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private base(): CookieOptions {
    return {
      secure: this.config.cookie.secure,
      sameSite: 'strict',
      domain: this.config.cookie.domain,
    };
  }

  private apiPath(): string {
    return `/${this.config.app.apiPrefix}`;
  }
}
