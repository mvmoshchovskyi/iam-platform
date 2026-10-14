import type { LucideIcon } from 'lucide-react';
import { Clock, KeyRound, MonitorSmartphone, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { useSessions } from '@/features/sessions/hooks';
import { DeviceIcon } from '@/features/sessions/components/DeviceIcon';
import { PageHeader } from '@/shared/components/PageHeader';
import { SectionCard } from '@/shared/components/SectionCard';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAuth } from '@/shared/hooks/useAuth';
import { formatDateTime, formatRelative } from '@/shared/lib/format';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <Icon className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
          {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const sessions = useSessions();
  if (!user) return null;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user.firstName ?? user.email.split('@')[0]}`}
        description="Here's an overview of your account security."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={MonitorSmartphone}
          label="Active sessions"
          value={
            sessions.isLoading ? <Skeleton className="h-8 w-10" /> : (sessions.data?.length ?? '—')
          }
          hint={
            <Link to="/profile/sessions" className="hover:underline">
              Manage devices
            </Link>
          }
        />
        <StatCard
          icon={Clock}
          label="Last sign-in"
          value={<span className="text-base">{formatRelative(user.lastLoginAt)}</span>}
          hint={user.lastLoginIp ? `from ${user.lastLoginIp}` : undefined}
        />
        <StatCard
          icon={user.twoFactorEnabled ? ShieldCheck : ShieldAlert}
          label="Two-factor auth"
          value={
            <Badge variant={user.twoFactorEnabled ? 'default' : 'destructive'}>
              {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          }
          hint={
            <Link to="/profile/2fa" className="hover:underline">
              {user.twoFactorEnabled ? 'View settings' : 'Turn it on'}
            </Link>
          }
        />
        <StatCard
          icon={KeyRound}
          label="Password changed"
          value={<span className="text-base">{formatRelative(user.passwordChangedAt)}</span>}
          hint={
            <Link to="/profile/password" className="hover:underline">
              Change password
            </Link>
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SectionCard
          title="Recent sessions"
          description="Devices currently signed in to your account."
          className="lg:col-span-2"
        >
          {sessions.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {sessions.data?.slice(0, 4).map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <DeviceIcon userAgent={s.userAgent} className="size-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.device}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.ipAddress ?? 'Unknown IP'} · active {formatRelative(s.lastActiveAt)}
                    </p>
                  </div>
                  {s.current && <Badge variant="secondary">This device</Badge>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Account">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Roles</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {user.roles.map((r) => (
                  <Badge key={r} variant="outline">
                    {r}
                  </Badge>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Member since</dt>
              <dd className="font-medium">{formatDateTime(user.createdAt)}</dd>
            </div>
          </dl>
          {!user.twoFactorEnabled && (
            <Button className="mt-4 w-full" asChild>
              <Link to="/profile/2fa">Secure your account with 2FA</Link>
            </Button>
          )}
        </SectionCard>
      </div>
    </>
  );
}
