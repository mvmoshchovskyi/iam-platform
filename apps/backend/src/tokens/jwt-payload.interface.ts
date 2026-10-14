/** Registered claims validated on every token. */
export interface JwtPayload {
  /** user id */
  sub: string;
  /** unique token id */
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AccessTokenPayload extends JwtPayload {
  typ: 'access';
  /** session (refresh token family) id — lets a revoked session kill its access tokens */
  sid: string;
}

export interface RefreshTokenPayload extends JwtPayload {
  typ: 'refresh';
  /** token family id */
  fam: string;
}

export interface TwoFactorChallengePayload extends JwtPayload {
  typ: '2fa';
  /** carry the "remember me" choice across the 2FA step */
  rme: boolean;
}
