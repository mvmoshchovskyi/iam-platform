import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PERMISSION_DESCRIPTIONS, SYSTEM_ROLES, SystemRole } from '../src/rbac/rbac.constants';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }

  for (const [name, def] of Object.entries(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description: def.description, isSystem: true },
      create: { name, description: def.description, isSystem: true },
    });
    const permissions = await prisma.permission.findMany({
      where: { key: { in: def.permissions } },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
    const passwordHash = await bcrypt.hash(password, rounds);
    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        emailVerifiedAt: new Date(),
        passwordChangedAt: new Date(),
        passwordHistory: { create: { passwordHash } },
      },
    });
    const roles = await prisma.role.findMany({
      where: { name: { in: [SystemRole.SUPER_ADMIN, SystemRole.USER] } },
    });
    await prisma.userRole.createMany({
      data: roles.map((r) => ({ userId: admin.id, roleId: r.id })),
      skipDuplicates: true,
    });
    console.warn(`Seeded super admin: ${email}`);
  }
  console.warn('Seed complete');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
