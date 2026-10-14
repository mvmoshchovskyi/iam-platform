import { ConflictException, NotFoundException } from '@nestjs/common';
import { type DeepMockProxy, mock, mockDeep, type MockProxy } from 'jest-mock-extended';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../database/prisma.service';
import { meta } from '../test-utils/mocks';
import type { EmailVerificationService } from './email-verification.service';
import { UsersService } from './users.service';
import type { UserWithAccess } from './users.types';

const role = (name: string, permissions: string[]) => ({
  userId: 'user-1',
  roleId: `${name}-id`,
  assignedById: null,
  assignedAt: new Date(),
  role: {
    id: `${name}-id`,
    name,
    description: null,
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: permissions.map((key) => ({
      roleId: `${name}-id`,
      permissionId: key,
      permission: { id: key, key, description: null, createdAt: new Date() },
    })),
  },
});

const buildUser = (overrides: Partial<UserWithAccess> = {}): UserWithAccess => ({
  id: 'user-1',
  email: 'jane@example.com',
  passwordHash: 'secret-hash',
  firstName: 'Jane',
  lastName: 'Doe',
  emailVerifiedAt: new Date(),
  pendingEmail: null,
  isActive: true,
  lockedUntil: null,
  twoFactorEnabled: false,
  lastLoginAt: null,
  lastLoginIp: null,
  passwordChangedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  roles: [
    role('USER', []),
    role('ADMIN', ['users:read', 'audit:read']),
    role('AUDITOR', ['audit:read']),
  ],
  ...overrides,
});

describe('UsersService', () => {
  let prisma: DeepMockProxy<PrismaService>;
  let emailVerification: MockProxy<EmailVerificationService>;
  let service: UsersService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    emailVerification = mock<EmailVerificationService>();
    service = new UsersService(prisma, emailVerification, mock<AuditService>());
  });

  describe('getProfile', () => {
    it('flattens roles and de-duplicates permissions without leaking the password hash', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());

      const profile = await service.getProfile('user-1');

      expect(profile.roles).toEqual(['USER', 'ADMIN', 'AUDITOR']);
      expect(profile.permissions).toEqual(['audit:read', 'users:read']);
      expect(profile.emailVerified).toBe(true);
      expect(profile).not.toHaveProperty('passwordHash');
    });

    it('hides expired lockouts', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ lockedUntil: new Date(Date.now() - 1000) }),
      );
      await expect(service.getProfile('user-1')).resolves.toMatchObject({ lockedUntil: null });
    });

    it('throws 404 for unknown users', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates names without triggering email verification', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      prisma.user.update.mockResolvedValue(buildUser({ firstName: 'Janet' }));

      const profile = await service.updateProfile('user-1', { firstName: 'Janet' }, meta);

      expect(profile.firstName).toBe('Janet');
      expect(emailVerification.createAndSend).not.toHaveBeenCalled();
    });

    it('stores a new email as pending and sends a confirmation to the new address', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      prisma.user.findFirst.mockResolvedValue(null);
      const updated = buildUser({ pendingEmail: 'new@example.com' });
      prisma.user.update.mockResolvedValue(updated);

      const profile = await service.updateProfile('user-1', { email: 'new@example.com' }, meta);

      expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
        pendingEmail: 'new@example.com',
      });
      expect(prisma.user.update.mock.calls[0][0].data).not.toHaveProperty('email');
      expect(emailVerification.createAndSend).toHaveBeenCalledWith(
        updated,
        'new@example.com',
        true,
      );
      expect(profile.email).toBe('jane@example.com');
    });

    it('rejects an email that belongs to another account', async () => {
      prisma.user.findUniqueOrThrow.mockResolvedValue(buildUser());
      prisma.user.findFirst.mockResolvedValue({ id: 'other' } as never);

      await expect(
        service.updateProfile('user-1', { email: 'taken@example.com' }, meta),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
