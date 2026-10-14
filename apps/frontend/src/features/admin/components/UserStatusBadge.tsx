import { Badge } from '@/shared/components/ui/badge';
import type { User } from '@/shared/types/api';

export function UserStatusBadge({
  user,
}: {
  user: Pick<User, 'isActive' | 'lockedUntil' | 'emailVerified'>;
}) {
  if (!user.isActive) return <Badge variant="destructive">Disabled</Badge>;
  if (user.lockedUntil) return <Badge variant="destructive">Locked</Badge>;
  if (!user.emailVerified) return <Badge variant="outline">Unverified</Badge>;
  return <Badge variant="secondary">Active</Badge>;
}
