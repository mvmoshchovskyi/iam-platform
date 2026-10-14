import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';
import { initials } from '@/shared/lib/format';
import type { User } from '@/shared/types/api';
import { cn } from '@/shared/lib/utils';

export function UserAvatar({
  user,
  className,
}: {
  user: Pick<User, 'firstName' | 'lastName' | 'email'>;
  className?: string;
}) {
  return (
    <Avatar className={cn('size-8', className)}>
      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
        {initials(user)}
      </AvatarFallback>
    </Avatar>
  );
}
