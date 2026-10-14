import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../rbac.constants';

export const PERMISSIONS_KEY = 'permissions';

/** Requires the caller to hold every listed permission. */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
