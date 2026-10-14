import * as Joi from 'joi';

const secret = Joi.string().min(32).required();

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  FRONTEND_URL: Joi.string().uri().required(),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),

  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  JWT_ACCESS_SECRET: secret,
  JWT_ACCESS_TTL: Joi.number().integer().min(60).default(900),
  JWT_REFRESH_SECRET: secret,
  JWT_REFRESH_TTL_DAYS: Joi.number().integer().min(1).default(7),
  JWT_REFRESH_REMEMBER_TTL_DAYS: Joi.number().integer().min(1).default(30),
  JWT_2FA_SECRET: secret,
  JWT_2FA_TTL: Joi.number().integer().min(60).default(300),
  JWT_ISSUER: Joi.string().required(),
  JWT_AUDIENCE: Joi.string().required(),

  COOKIE_DOMAIN: Joi.string().allow('').optional(),

  TWO_FACTOR_ENC_KEY: Joi.string().base64().length(44).required(),
  TWO_FACTOR_ISSUER: Joi.string().default('IAM Platform'),

  BCRYPT_ROUNDS: Joi.number().integer().min(4).max(15).default(12),
  PASSWORD_HISTORY_DEPTH: Joi.number().integer().min(0).max(24).default(5),
  LOCKOUT_THRESHOLD: Joi.number().integer().min(1).default(5),
  LOCKOUT_DURATION_MIN: Joi.number().integer().min(1).default(15),
  REVOKE_SESSIONS_ON_PASSWORD_CHANGE: Joi.boolean().default(true),

  THROTTLE_TTL: Joi.number().integer().min(1).default(60),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),

  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().port().required(),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().required(),

  SEED_ADMIN_EMAIL: Joi.string().email({ tlds: false }).optional(),
  SEED_ADMIN_PASSWORD: Joi.string().optional(),
});
