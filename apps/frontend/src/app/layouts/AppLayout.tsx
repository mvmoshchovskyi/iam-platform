import { LogOut, Menu, ShieldCheck, User } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useLogout } from '@/features/auth/hooks';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { RoleGuard } from '@/shared/components/RoleGuard';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/components/ui/sheet';
import { UserAvatar } from '@/shared/components/UserAvatar';
import { useAuth } from '@/shared/hooks/useAuth';
import { displayName } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { NAV_SECTIONS } from './navigation';

function Brand() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2 px-2 font-semibold">
      <ShieldCheck className="size-6 text-primary" />
      IAM Platform
    </Link>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-6" aria-label="Main">
      {NAV_SECTIONS.map((section, i) => {
        const content = (
          <div key={section.title ?? i} className="flex flex-col gap-1">
            {section.title && (
              <p className="px-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {section.title}
              </p>
            )}
            {section.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted',
                    isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </div>
        );
        return section.roles ? (
          <RoleGuard key={section.title} roles={section.roles}>
            {content}
          </RoleGuard>
        ) : (
          content
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const { user } = useAuth();
  const logout = useLogout();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2" aria-label="Account menu">
          <UserAvatar user={user} />
          <span className="hidden max-w-40 truncate text-sm sm:inline">{displayName(user)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{displayName(user)}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {user.roles.map((r) => (
              <Badge key={r} variant="secondary">
                {r}
              </Badge>
            ))}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile/settings">
            <User /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={logout.isPending}
          onSelect={() => logout.mutate()}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Authenticated shell: fixed sidebar on desktop, slide-over sheet behind a hamburger on mobile. */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-svh bg-muted/30 lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r bg-background lg:flex lg:flex-col lg:gap-6 lg:p-4">
        <Brand />
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4">
              <SheetHeader className="p-0 pb-4">
                <SheetTitle asChild>
                  <div>
                    <Brand />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <SidebarNav onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
          {/* Reset the boundary on navigation so one broken page doesn't stick */}
          <ErrorBoundary key={location.pathname}>
            <Suspense
              fallback={
                <div className="flex justify-center py-24">
                  <LoadingSpinner className="size-6" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
