import { lazy, type ReactNode, Suspense } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { onSessionExpired } from '@/shared/api/session-events';
import { GuestRoute } from '@/shared/components/GuestRoute';
import { FullPageSpinner } from '@/shared/components/LoadingSpinner';
import { PrivateRoute } from '@/shared/components/PrivateRoute';
import { RoleGuard } from '@/shared/components/RoleGuard';
import { ADMIN_ROLES } from '@/shared/types/api';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';

// Route-level code splitting
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const TwoFactorPage = lazy(() => import('@/pages/TwoFactorPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProfileSettingsPage = lazy(() => import('@/pages/ProfileSettingsPage'));
const ProfilePasswordPage = lazy(() => import('@/pages/ProfilePasswordPage'));
const ProfileTwoFactorPage = lazy(() => import('@/pages/ProfileTwoFactorPage'));
const ProfileSessionsPage = lazy(() => import('@/pages/ProfileSessionsPage'));
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'));
const AdminRolesPage = lazy(() => import('@/pages/AdminRolesPage'));
const AdminAuditLogsPage = lazy(() => import('@/pages/AdminAuditLogsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'));

const suspense = (node: ReactNode) => <Suspense fallback={<FullPageSpinner />}>{node}</Suspense>;

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  {
    element: suspense(<AuthLayout />),
    children: [
      {
        element: (
          <GuestRoute>
            <Outlet />
          </GuestRoute>
        ),
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
          { path: '/reset-password', element: <ResetPasswordPage /> },
          { path: '/2fa', element: <TwoFactorPage /> },
        ],
      },
      // Reachable signed in or out (email change confirmation for signed-in users)
      { path: '/verify-email', element: <VerifyEmailPage /> },
    ],
  },
  {
    element: (
      <PrivateRoute>
        <AppLayout />
      </PrivateRoute>
    ),
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      { path: '/profile', element: <Navigate to="/profile/settings" replace /> },
      { path: '/profile/settings', element: <ProfileSettingsPage /> },
      { path: '/profile/password', element: <ProfilePasswordPage /> },
      { path: '/profile/2fa', element: <ProfileTwoFactorPage /> },
      { path: '/profile/sessions', element: <ProfileSessionsPage /> },
      {
        path: '/admin',
        element: (
          <RoleGuard roles={ADMIN_ROLES} fallback={<Navigate to="/unauthorized" replace />}>
            <Outlet />
          </RoleGuard>
        ),
        children: [
          { index: true, element: <Navigate to="/admin/users" replace /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'roles', element: <AdminRolesPage /> },
          { path: 'audit-logs', element: <AdminAuditLogsPage /> },
        ],
      },
      { path: '/unauthorized', element: <UnauthorizedPage /> },
    ],
  },
  { path: '*', element: suspense(<NotFoundPage />) },
]);

// When a refresh fails mid-session, send the user to sign in and come back afterwards
onSessionExpired(() => {
  const { pathname, search } = window.location;
  if (pathname !== '/login')
    void router.navigate('/login', { replace: true, state: { from: `${pathname}${search}` } });
});
