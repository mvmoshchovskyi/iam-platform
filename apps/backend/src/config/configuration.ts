const bool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value === '' ? fallback : value === 'true';

export const configuration = () => {
  const env = process.env;
  const nodeEnv = env.NODE_ENV ?? 'development';
  return {
    app: {
      env: nodeEnv,
      isProduction: nodeEnv === 'production',
      isTest: nodeEnv === 'test',
      port: Number(env.PORT ?? 3000),
      apiPrefix: env.API_PREFIX ?? 'api',
      frontendUrl: env.FRONTEND_URL ?? 'http://localhost:5173',
      logLevel: env.LOG_LEVEL ?? 'info',
    },
    database: {
      url: env.DATABASE_URL!,
    },
    redis: {
      host: env.REDIS_HOST ?? 'localhost',
      port: Number(env.REDIS_PORT ?? 6379),
      password: env.REDIS_PASSWORD || undefined,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET!,
      accessTtl: Number(env.JWT_ACCESS_TTL ?? 900),
      refreshSecret: env.JWT_REFRESH_SECRET!,
      refreshTtlDays: Number(env.JWT_REFRESH_TTL_DAYS ?? 7),
      refreshRememberTtlDays: Number(env.JWT_REFRESH_REMEMBER_TTL_DAYS ?? 30),
      twoFactorSecret: env.JWT_2FA_SECRET!,
      twoFactorTtl: Number(env.JWT_2FA_TTL ?? 300),
      issuer: env.JWT_ISSUER ?? 'iam-platform',
      audience: env.JWT_AUDIENCE ?? 'iam-platform-web',
    },
    cookie: {
      domain: env.COOKIE_DOMAIN || undefined,
      secure: nodeEnv === 'production',
    },
    twoFactor: {
      encryptionKey: env.TWO_FACTOR_ENC_KEY!,
      issuer: env.TWO_FACTOR_ISSUER ?? 'IAM Platform',
    },
    security: {
      bcryptRounds: Number(env.BCRYPT_ROUNDS ?? 12),
      passwordHistoryDepth: Number(env.PASSWORD_HISTORY_DEPTH ?? 5),
      lockoutThreshold: Number(env.LOCKOUT_THRESHOLD ?? 5),
      lockoutDurationMin: Number(env.LOCKOUT_DURATION_MIN ?? 15),
      revokeSessionsOnPasswordChange: bool(env.REVOKE_SESSIONS_ON_PASSWORD_CHANGE, true),
    },
    throttle: {
      ttlSeconds: Number(env.THROTTLE_TTL ?? 60),
      limit: Number(env.THROTTLE_LIMIT ?? 100),
    },
    mail: {
      host: env.SMTP_HOST ?? 'localhost',
      port: Number(env.SMTP_PORT ?? 1025),
      secure: bool(env.SMTP_SECURE, false),
      user: env.SMTP_USER || undefined,
      pass: env.SMTP_PASS || undefined,
      from: env.MAIL_FROM ?? 'IAM Platform <no-reply@iam.local>',
    },
  };
};

export type AppConfig = ReturnType<typeof configuration>;
