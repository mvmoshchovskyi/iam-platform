import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user';

/**
 * Injects the authenticated user resolved by JwtStrategy. Controllers must use this
 * (never a client-supplied id) when acting on behalf of the caller.
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest<Request>().user as AuthUser | undefined;
    return field ? user?.[field] : user;
  },
);
