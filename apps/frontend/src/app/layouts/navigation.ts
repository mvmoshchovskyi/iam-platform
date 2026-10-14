import type { LucideIcon } from 'lucide-react';
import {
  FileClock,
  KeyRound,
  LayoutDashboard,
  MonitorSmartphone,
  ShieldCheck,
  ShieldHalf,
  User,
  Users,
} from 'lucide-react';
import { ADMIN_ROLES } from '@/shared/types/api';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
  roles?: string[];
}

export const NAV_SECTIONS: NavSection[] = [
  { items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'Account',
    items: [
      { to: '/profile/settings', label: 'Profile', icon: User },
      { to: '/profile/password', label: 'Password', icon: KeyRound },
      { to: '/profile/2fa', label: 'Two-factor auth', icon: ShieldCheck },
      { to: '/profile/sessions', label: 'Sessions', icon: MonitorSmartphone },
    ],
  },
  {
    title: 'Administration',
    roles: ADMIN_ROLES,
    items: [
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/roles', label: 'Roles', icon: ShieldHalf },
      { to: '/admin/audit-logs', label: 'Audit logs', icon: FileClock },
    ],
  },
];
