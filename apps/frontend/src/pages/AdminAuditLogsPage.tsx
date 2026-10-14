import { FileClock, X } from 'lucide-react';
import { useSearchParams } from 'react-router';
import type { AuditLogParams } from '@/features/admin/api';
import { actionVariant, AUDIT_ACTIONS } from '@/features/admin/audit-actions';
import { useAuditLogs } from '@/features/admin/hooks';
import { type Column, DataTable } from '@/shared/components/DataTable';
import { EmptyState } from '@/shared/components/EmptyState';
import { FormField } from '@/shared/components/FormField';
import { PageHeader } from '@/shared/components/PageHeader';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { formatDateTime } from '@/shared/lib/format';
import type { AuditLog } from '@/shared/types/api';

const ALL = 'all';

/** yyyy-mm-dd (local) → ISO bounds covering the whole day */
const dayStart = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const dayEnd = (d: string | null) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : undefined);

export default function AdminAuditLogsPage() {
  const [params, setParams] = useSearchParams();
  const userEmail = params.get('userEmail');

  const query: AuditLogParams = {
    page: Number(params.get('page') ?? 1),
    limit: 20,
    userId: params.get('userId') ?? undefined,
    action: params.get('action') ?? undefined,
    from: dayStart(params.get('from')),
    to: dayEnd(params.get('to')),
  };
  const logs = useAuditLogs(query);

  const update = (changes: Record<string, string | undefined>, resetPage = true) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(changes)) {
        if (!v || v === ALL) next.delete(k);
        else next.set(k, v);
      }
      if (resetPage) next.delete('page');
      return next;
    });

  const userLink = (ref: AuditLog['user']) =>
    ref ? (
      <button
        type="button"
        className="max-w-48 truncate text-left hover:underline"
        title="Filter by this user"
        onClick={() => update({ userId: ref.id, userEmail: ref.email })}
      >
        {ref.email}
      </button>
    ) : (
      <span className="text-muted-foreground">—</span>
    );

  const columns: Column<AuditLog>[] = [
    {
      id: 'time',
      header: 'Time',
      cell: (l) => <span className="whitespace-nowrap">{formatDateTime(l.createdAt)}</span>,
    },
    {
      id: 'action',
      header: 'Action',
      cell: (l) => <Badge variant={actionVariant(l.action)}>{l.action}</Badge>,
    },
    { id: 'user', header: 'User', cell: (l) => userLink(l.user) },
    {
      id: 'actor',
      header: 'Actor',
      cell: (l) =>
        l.actor && l.actor.id !== l.user?.id ? (
          userLink(l.actor)
        ) : (
          <span className="text-muted-foreground">self</span>
        ),
    },
    {
      id: 'ip',
      header: 'IP',
      cell: (l) => <span className="font-mono text-xs">{l.ipAddress ?? '—'}</span>,
    },
    {
      id: 'details',
      header: 'Details',
      cell: (l) =>
        l.metadata && Object.keys(l.metadata).length ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">
                View
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <pre className="max-h-64 overflow-auto text-xs whitespace-pre-wrap">
                {JSON.stringify(l.metadata, null, 2)}
              </pre>
              {l.userAgent && (
                <p className="mt-2 border-t pt-2 text-xs break-all text-muted-foreground">
                  {l.userAgent}
                </p>
              )}
            </PopoverContent>
          </Popover>
        ) : null,
    },
  ];

  const hasFilters = ['userId', 'action', 'from', 'to'].some((k) => params.get(k));

  return (
    <>
      <PageHeader title="Audit logs" description="Security-relevant events across the platform." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormField id="action-filter" label="Action">
          <Select value={query.action ?? ALL} onValueChange={(v) => update({ action: v })}>
            <SelectTrigger id="action-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id="from" label="From">
          <Input
            id="from"
            type="date"
            value={params.get('from') ?? ''}
            onChange={(e) => update({ from: e.target.value })}
          />
        </FormField>
        <FormField id="to" label="To">
          <Input
            id="to"
            type="date"
            value={params.get('to') ?? ''}
            onChange={(e) => update({ to: e.target.value })}
          />
        </FormField>
        <div className="flex items-end gap-2">
          {query.userId && (
            <Badge variant="secondary" className="h-9 max-w-full gap-1 px-3">
              <span className="truncate">{userEmail ?? query.userId}</span>
              <button
                type="button"
                aria-label="Clear user filter"
                onClick={() => update({ userId: undefined, userEmail: undefined })}
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
          {hasFilters && (
            <Button variant="ghost" onClick={() => setParams(new URLSearchParams())}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs.data?.items}
        isLoading={logs.isLoading}
        getRowId={(l) => l.id}
        pagination={
          logs.data && {
            ...logs.data.meta,
            onPageChange: (page) => update({ page: String(page) }, false),
          }
        }
        empty={<EmptyState icon={FileClock} title="No events match these filters" />}
      />
    </>
  );
}
