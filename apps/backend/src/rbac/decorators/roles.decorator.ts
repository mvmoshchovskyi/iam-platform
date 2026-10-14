import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Requires the caller to hold at least one of the listed roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
