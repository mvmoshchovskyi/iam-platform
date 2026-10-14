import { Search, Users } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { AdminUsersParams } from '@/features/admin/api';
import { UserDetailDialog } from '@/features/admin/components/UserDetailDialog';
import { UserStatusBadge } from '@/features/admin/components/UserStatusBadge';
import { useAdminUsers, useRoles } from '@/features/admin/hooks';
import { type Column, DataTable } from '@/shared/components/DataTable';
import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { UserAvatar } from '@/shared/components/UserAvatar';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { displayName, formatDateTime, formatRelative } from '@/shared/lib/format';
import type { AdminUser } from '@/shared/types/api';

const ALL = 'all';
const PAGE_SIZE = 10;

export default function AdminUsersPage() {
  // Filters live in the URL so views are shareable and survive refresh
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const roles = useRoles();

  const query: AdminUsersParams = {
    page: Number(params.get('page') ?? 1),
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    role: params.get('role') ?? undefined,
    status: (params.get('status') as AdminUsersParams['status']) ?? undefined,
    sortBy: (params.get('sortBy') as AdminUsersParams['sortBy']) ?? 'createdAt',
    sortOrder: (params.get('sortOrder') as AdminUsersParams['sortOrder']) ?? 'desc',
  };
  const users = useAdminUsers(query);

  const update = (changes: Record<string, string | undefined>, resetPage = true) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) {
        if (v === undefined || v === ALL || v === '') next.delete(k);
        else next.set(k, v);
      }
      if (resetPage) next.delete('page');
      return next;
    });

  const columns: Column<AdminUser>[] = [
    {
      id: 'email',
      header: 'User',
      sortable: true,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <UserAvatar user={u} />
          <div className="min-w-0">
            <p className="truncate font-medium">{displayName(u)}</p>
            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r} variant={r === 'USER' ? 'outline' : 'secondary'}>
              {r}
            </Badge>
          ))}
        </div>
      ),
    },
    { id: 'status', header: 'Status', cell: (u) => <UserStatusBadge user={u} /> },
    { id: 'sessions', header: 'Sessions', className: 'text-center', cell: (u) => u.activeSessions },
    {
      id: 'lastLoginAt',
      header: 'Last sign-in',
      sortable: true,
      cell: (u) => formatRelative(u.lastLoginAt),
    },
    {
      id: 'createdAt',
      header: 'Created',
      sortable: true,
      cell: (u) => formatDateTime(u.createdAt),
    },
  ];

  return (
    <>
      <PageHeader title="Users" description="Search accounts, manage roles and account status." />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              update({ search: e.target.value.trim() || undefined });
            }}
            placeholder="Search by email or name…"
            className="pl-8"
            aria-label="Search users"
            autoFocus
          />
        </div>
        <Select value={query.role ?? ALL} onValueChange={(v) => update({ role: v })}>
          <SelectTrigger className="sm:w-44" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {roles.data?.map((r) => (
              <SelectItem key={r.id} value={r.name}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={query.status ?? ALL} onValueChange={(v) => update({ status: v })}>
          <SelectTrigger className="sm:w-40" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={users.data?.items}
        isLoading={users.isLoading}
        getRowId={(u) => u.id}
        onRowClick={(u) => setSelectedId(u.id)}
        sort={{
          by: query.sortBy!,
          order: query.sortOrder!,
          onChange: (sortBy, sortOrder) => update({ sortBy, sortOrder }),
        }}
        pagination={
          users.data && {
            ...users.data.meta,
            onPageChange: (page) => update({ page: String(page) }, false),
          }
        }
        empty={<EmptyState icon={Users} title="No users match your filters" />}
      />

      <UserDetailDialog userId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
