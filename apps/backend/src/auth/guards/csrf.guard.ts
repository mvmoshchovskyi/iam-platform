import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { safeEqual } from '../../common/utils/crypto.util';
import { CSRF_COOKIE, CSRF_HEADER } from '../../tokens/auth-cookie.service';

/** Double Submit Cookie check for endpoints authenticated by the refresh cookie. */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const cookie = (req.cookies as Record<string, string | undefined> | undefined)?.[CSRF_COOKIE];
    const header = req.get(CSRF_HEADER);
    if (cookie && header && safeEqual(cookie, header)) return true;
    throw new ForbiddenException({ message: 'Invalid CSRF token', code: 'CSRF_INVALID' });
  }
}
