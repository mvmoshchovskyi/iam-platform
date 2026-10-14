import { Lock, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { CreateRoleDialog } from '@/features/admin/components/CreateRoleDialog';
import {
  useDeleteRole,
  usePermissionList,
  useRoles,
  useUpdateRolePermissions,
} from '@/features/admin/hooks';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { PageHeader } from '@/shared/components/PageHeader';
import { RoleGuard } from '@/shared/components/RoleGuard';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { usePermissions } from '@/shared/hooks/usePermissions';
import type { PermissionItem, Role } from '@/shared/types/api';

function RoleCard({
  role,
  allPermissions,
  onDelete,
}: {
  role: Role;
  allPermissions: PermissionItem[];
  onDelete: () => void;
}) {
  const { hasPermission } = usePermissions();
  const update = useUpdateRolePermissions();
  const [draft, setDraft] = useState<string[] | null>(null);
  const current = draft ?? role.permissions;
  const editable = hasPermission('roles:write') && role.name !== 'SUPER_ADMIN';
  const dirty = draft !== null && [...draft].sort().join() !== [...role.permissions].sort().join();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {role.name}
          {role.isSystem && (
            <Badge variant="outline" className="gap-1">
              <Lock className="size-3" /> System
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{role.description ?? 'No description'}</CardDescription>
        <CardAction>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="size-4" /> {role.userCount}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {allPermissions.map((p) => (
          <div key={p.key} className="flex items-center gap-2">
            <Checkbox
              id={`${role.id}-${p.key}`}
              checked={current.includes(p.key)}
              disabled={!editable || update.isPending}
              onCheckedChange={(checked) =>
                setDraft(checked ? [...current, p.key] : current.filter((k) => k !== p.key))
              }
            />
            <Label
              htmlFor={`${role.id}-${p.key}`}
              className="font-mono text-xs font-normal"
              title={p.description ?? ''}
            >
              {p.key}
            </Label>
          </div>
        ))}
      </CardContent>
      {(editable || !role.isSystem) && (
        <CardFooter className="justify-between gap-2 border-t">
          <RoleGuard permissions={['roles:write']}>
            {!role.isSystem ? (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
                <Trash2 /> Delete
              </Button>
            ) : (
              <span />
            )}
          </RoleGuard>
          {editable && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!dirty} onClick={() => setDraft(null)}>
                Reset
              </Button>
              <Button
                size="sm"
                disabled={!dirty || update.isPending}
                onClick={() =>
                  update.mutate(
                    { id: role.id, permissions: current },
                    { onSuccess: () => setDraft(null) },
                  )
                }
              >
                Save
              </Button>
            </div>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

export default function AdminRolesPage() {
  const roles = useRoles();
  const permissions = usePermissionList();
  const deleteRole = useDeleteRole();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Role | null>(null);

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="System roles can't be deleted; SUPER_ADMIN always holds every permission."
        actions={
          <RoleGuard permissions={['roles:write']}>
            <Button onClick={() => setCreating(true)}>
              <Plus /> New role
            </Button>
          </RoleGuard>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {roles.isLoading || permissions.isLoading
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56 w-full rounded-xl" />)
          : roles.data?.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                allPermissions={permissions.data ?? []}
                onDelete={() => setToDelete(role)}
              />
            ))}
      </div>

      <CreateRoleDialog open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete role ${toDelete?.name}?`}
        description={`${toDelete?.userCount ?? 0} user(s) will lose this role and its permissions.`}
        confirmLabel="Delete role"
        destructive
        loading={deleteRole.isPending}
        onConfirm={() =>
          toDelete && deleteRole.mutate(toDelete.id, { onSettled: () => setToDelete(null) })
        }
      />
    </>
  );
}
