const CSRF_COOKIE = 'csrf_token';

/** Reads the double-submit CSRF cookie set by the API next to the HttpOnly refresh cookie. */
export const getCsrfToken = (): string | null => {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(CSRF_COOKIE.length + 1)) : null;
};

/** The CSRF cookie lives exactly as long as the refresh cookie, so it signals a possible session. */
export const hasSessionCookie = (): boolean => getCsrfToken() !== null;
