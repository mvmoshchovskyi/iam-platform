import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthUser } from '../../common/types/auth-user';
import { AppConfigService } from '../../config/app-config.service';
import type { AccessTokenPayload } from '../../tokens/jwt-payload.interface';
import { TokenService } from '../../tokens/token.service';
import { UsersService } from '../../users/users.service';

const unauthorized = (message = 'Invalid or expired access token', code = 'INVALID_ACCESS_TOKEN') =>
  new UnauthorizedException({ message, code });

/**
 * Validates the bearer access token (signature, exp, HS256 allowlist, iss, aud), checks
 * revocation state in Redis and loads the user's current roles/permissions from the DB —
 * authorization never relies on claims supplied by the client.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: AppConfigService,
    private readonly tokens: TokenService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.jwt.accessSecret,
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      ignoreExpiration: false,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    if (payload.typ !== 'access' || !payload.sid) throw unauthorized();
    if (await this.tokens.isAccessTokenRevoked(payload))
      throw unauthorized('Session has been revoked', 'SESSION_REVOKED');

    const ctx = await this.users.findAuthContext(payload.sub);
    if (!ctx || !ctx.user.isActive)
      throw unauthorized('Account is not available', 'ACCOUNT_UNAVAILABLE');

    return {
      id: ctx.user.id,
      email: ctx.user.email,
      roles: ctx.roles,
      permissions: ctx.permissions,
      sessionId: payload.sid,
      jti: payload.jti,
      exp: payload.exp,
    };
  }
}
