import { Lock, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { RoleGuard } from '@/shared/components/RoleGuard';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';
import { UserAvatar } from '@/shared/components/UserAvatar';
import { useAuth } from '@/shared/hooks/useAuth';
import { displayName, formatDateTime } from '@/shared/lib/format';
import { useAdminUser, useRoles, useUpdateUserRole, useUpdateUserStatus } from '../hooks';
import { UserStatusBadge } from './UserStatusBadge';

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{children}</dd>
  </div>
);

export function UserDetailDialog({
  userId,
  onClose,
}: {
  userId: string | null;
  onClose: () => void;
}) {
  const { user: me } = useAuth();
  const { data: user, isLoading } = useAdminUser(userId);
  const roles = useRoles();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();
  const [roleToAdd, setRoleToAdd] = useState('');
  const [confirmDisable, setConfirmDisable] = useState(false);

  const assignable = roles.data?.filter((r) => !user?.roles.includes(r.name)) ?? [];
  const isSelf = user?.id === me?.id;

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {isLoading || !user ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner className="size-6" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <UserAvatar user={user} className="size-10" />
                <div className="min-w-0 text-left">
                  <DialogTitle className="truncate">{displayName(user)}</DialogTitle>
                  <DialogDescription className="truncate">{user.email}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <dl className="space-y-2">
              <Row label="Status">
                <UserStatusBadge user={user} />
              </Row>
              <Row label="2FA">{user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</Row>
              <Row label="Last sign-in">
                {formatDateTime(user.lastLoginAt)}
                {user.lastLoginIp && (
                  <span className="text-muted-foreground"> · {user.lastLoginIp}</span>
                )}
              </Row>
              <Row label="Active sessions">{user.activeSessions}</Row>
              <Row label="Created">{formatDateTime(user.createdAt)}</Row>
              {user.lockedUntil && (
                <Row label="Locked until">{formatDateTime(user.lockedUntil)}</Row>
              )}
            </dl>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium">Roles</p>
              <div className="flex flex-wrap gap-2">
                {user.roles.map((name) => {
                  const role = roles.data?.find((r) => r.name === name);
                  return (
                    <Badge key={name} variant="secondary" className="gap-1 pr-1">
                      {name}
                      <RoleGuard permissions={['users:write']}>
                        <button
                          type="button"
                          aria-label={`Remove role ${name}`}
                          className="rounded-sm p-0.5 hover:bg-background/60 disabled:opacity-50"
                          disabled={!role || updateRole.isPending}
                          onClick={() =>
                            role &&
                            updateRole.mutate({
                              userId: user.id,
                              roleId: role.id,
                              roleName: name,
                              action: 'remove',
                            })
                          }
                        >
                          <X className="size-3" />
                        </button>
                      </RoleGuard>
                    </Badge>
                  );
                })}
              </div>
              <RoleGuard permissions={['users:write']}>
                <div className="flex gap-2">
                  <Select value={roleToAdd} onValueChange={setRoleToAdd}>
                    <SelectTrigger className="flex-1" aria-label="Role to assign">
                      <SelectValue placeholder="Assign a role…" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignable.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    disabled={!roleToAdd || updateRole.isPending}
                    onClick={() => {
                      const role = roles.data?.find((r) => r.id === roleToAdd);
                      if (!role) return;
                      updateRole.mutate(
                        { userId: user.id, roleId: role.id, roleName: role.name, action: 'assign' },
                        { onSuccess: () => setRoleToAdd('') },
                      );
                    }}
                  >
                    <Plus /> Add
                  </Button>
                </div>
              </RoleGuard>
            </div>

            <RoleGuard permissions={['users:write']}>
              <Separator />
              <div className="flex flex-wrap justify-end gap-2">
                {user.lockedUntil && (
                  <Button
                    variant="outline"
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ userId: user.id, unlock: true })}
                  >
                    <Lock /> Unlock account
                  </Button>
                )}
                {user.isActive ? (
                  <Button
                    variant="destructive"
                    disabled={isSelf || updateStatus.isPending}
                    onClick={() => setConfirmDisable(true)}
                  >
                    Disable account
                  </Button>
                ) : (
                  <Button
                    disabled={updateStatus.isPending}
                    onClick={() => updateStatus.mutate({ userId: user.id, isActive: true })}
                  >
                    Enable account
                  </Button>
                )}
              </div>
            </RoleGuard>

            <ConfirmDialog
              open={confirmDisable}
              onOpenChange={setConfirmDisable}
              title={`Disable ${user.email}?`}
              description="The user is signed out of every session immediately and can't sign in until re-enabled."
              confirmLabel="Disable"
              destructive
              loading={updateStatus.isPending}
              onConfirm={() =>
                updateStatus.mutate(
                  { userId: user.id, isActive: false },
                  { onSettled: () => setConfirmDisable(false) },
                )
              }
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
