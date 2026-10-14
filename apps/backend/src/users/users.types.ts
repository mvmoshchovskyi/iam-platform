import type { Prisma } from '@prisma/client';

export const userWithAccessInclude = {
  roles: {
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  },
} satisfies Prisma.UserInclude;

export type UserWithAccess = Prisma.UserGetPayload<{ include: typeof userWithAccessInclude }>;

export const flattenAccess = (user: UserWithAccess) => {
  const roles = user.roles.map((ur) => ur.role.name);
  const permissions = [
    ...new Set(user.roles.flatMap((ur) => ur.role.permissions.map((rp) => rp.permission.key))),
  ].sort();
  return { roles, permissions };
};
