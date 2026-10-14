/** Shape of `request.user` after JwtStrategy validation. */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  /** id of the access token (jti) — used for logout denylisting */
  jti: string;
  /** access token expiry (unix seconds) */
  exp: number;
}
