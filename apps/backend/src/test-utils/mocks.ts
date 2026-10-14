import type { DeepMockProxy } from 'jest-mock-extended';
import type { AppConfigService } from '../config/app-config.service';
import { configuration } from '../config/configuration';
import type { PrismaService } from '../database/prisma.service';

/** Real config values with test secrets — services read plain objects from AppConfigService. */
export const testConfig = (): AppConfigService => {
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-test-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-test-refresh-secret';
  process.env.JWT_2FA_SECRET ??= 'test-2fa-secret-test-2fa-secret-test';
  process.env.TWO_FACTOR_ENC_KEY ??= Buffer.alloc(32, 7).toString('base64');
  process.env.BCRYPT_ROUNDS ??= '4';
  return configuration() as unknown as AppConfigService;
};

/** Makes `prisma.$transaction` run callbacks against the same mock and resolve arrays. */
export const wireTransactions = (prisma: DeepMockProxy<PrismaService>): void => {
  (prisma.$transaction as jest.Mock).mockImplementation((arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => unknown)(prisma)
      : Promise.all(arg as unknown[]),
  );
};

export const meta = { ipAddress: '203.0.113.7', userAgent: 'jest-agent' };
