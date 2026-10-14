import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useState } from 'react';
import { DeviceIcon } from '@/features/sessions/components/DeviceIcon';
import { useRevokeOtherSessions, useRevokeSession, useSessions } from '@/features/sessions/hooks';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { type Column, DataTable } from '@/shared/components/DataTable';
import { EmptyState } from '@/shared/components/EmptyState';
import { PageHeader } from '@/shared/components/PageHeader';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { formatDateTime, formatRelative } from '@/shared/lib/format';
import type { Session } from '@/shared/types/api';

export default function ProfileSessionsPage() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();
  const [target, setTarget] = useState<Session | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const otherCount = sessions.data?.filter((s) => !s.current).length ?? 0;

  const columns: Column<Session>[] = [
    {
      id: 'device',
      header: 'Device',
      sortValue: (s) => s.device,
      cell: (s) => (
        <div className="flex items-center gap-3">
          <DeviceIcon userAgent={s.userAgent} className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="max-w-56 truncate font-medium">{s.device}</p>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm break-all">
                {s.userAgent ?? 'Unknown user agent'}
              </TooltipContent>
            </Tooltip>
            <div className="mt-0.5 flex gap-1">
              {s.current && <Badge>This device</Badge>}
              {s.rememberMe && <Badge variant="outline">Remembered</Badge>}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'ip',
      header: 'IP address',
      sortValue: (s) => s.ipAddress,
      cell: (s) => <span className="font-mono text-xs">{s.ipAddress ?? '—'}</span>,
    },
    {
      id: 'created',
      header: 'Signed in',
      sortValue: (s) => s.createdAt,
      cell: (s) => formatDateTime(s.createdAt),
    },
    {
      id: 'active',
      header: 'Last active',
      sortValue: (s) => s.lastActiveAt,
      cell: (s) => formatRelative(s.lastActiveAt),
    },
    {
      id: 'actions',
      header: '',
      className: 'text-right',
      cell: (s) =>
        s.current ? null : (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() => setTarget(s)}
          >
            Revoke
          </Button>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Active sessions"
        description="Devices signed in to your account. Revoke anything you don't recognise."
        actions={
          <Button
            variant="outline"
            disabled={otherCount === 0 || revokeOthers.isPending}
            onClick={() => setConfirmAll(true)}
          >
            <LogOut /> Sign out other sessions
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={sessions.data}
        isLoading={sessions.isLoading}
        getRowId={(s) => s.id}
        empty={<EmptyState icon={MonitorSmartphone} title="No active sessions" />}
      />

      <ConfirmDialog
        open={!!target}
        onOpenChange={(open) => !open && setTarget(null)}
        title="Revoke this session?"
        description={
          target
            ? `${target.device} (${target.ipAddress ?? 'unknown IP'}) will be signed out immediately.`
            : undefined
        }
        confirmLabel="Revoke"
        destructive
        onConfirm={() => {
          if (target) revoke.mutate(target.id);
          setTarget(null);
        }}
      />
      <ConfirmDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Sign out all other sessions?"
        description={`${otherCount} other device(s) will be signed out. This device stays signed in.`}
        confirmLabel="Sign out others"
        destructive
        onConfirm={() => {
          revokeOthers.mutate();
          setConfirmAll(false);
        }}
      />
    </>
  );
}
