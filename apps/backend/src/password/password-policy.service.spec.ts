import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { type DeepMockProxy, mockDeep } from 'jest-mock-extended';
import type { PrismaService } from '../database/prisma.service';
import { testConfig } from '../test-utils/mocks';
import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let service: PasswordPolicyService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new PasswordPolicyService(testConfig(), prisma);
  });

  it.each(['password1234', 'qwertyuiop12', 'jane.doe.2026'])('rejects weak password %s', (pw) => {
    expect(() => service.assertStrong(pw, ['jane.doe@example.com'])).toThrow(BadRequestException);
  });

  it('accepts a strong passphrase', () => {
    expect(() =>
      service.assertStrong('violet-Tractor-sings-42', ['jane@example.com']),
    ).not.toThrow();
  });

  it('hashes with bcrypt and verifies', async () => {
    const hash = await service.hash('violet-Tractor-sings-42');
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(service.compare('violet-Tractor-sings-42', hash)).resolves.toBe(true);
    await expect(service.compare('nope', hash)).resolves.toBe(false);
  });

  it('compares against a dummy hash when the user does not exist', async () => {
    await expect(service.compare('anything', null)).resolves.toBe(false);
  });

  it('rejects a password found in the recent history', async () => {
    prisma.passwordHistory.findMany.mockResolvedValue([
      { passwordHash: await bcrypt.hash('other-Password-1', 4) },
      { passwordHash: await bcrypt.hash('violet-Tractor-sings-42', 4) },
    ] as never);
    await expect(
      service.assertNotReused('user-1', 'violet-Tractor-sings-42'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PASSWORD_REUSED' }),
    });
    expect(prisma.passwordHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });
});
