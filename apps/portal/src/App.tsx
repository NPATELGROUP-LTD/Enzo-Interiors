import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { PortalLayout } from './components/layout/PortalLayout';
import { LoadingState } from './components/ui';
import { useAuth } from './lib/auth';
import { connectSocket, disconnectSocket } from './lib/socket';
import { DashboardPage } from './pages/Dashboard';
import { DocumentsPage } from './pages/Documents';
import { InvoiceDetailPage } from './pages/InvoiceDetail';
import { InvoicesPage } from './pages/Invoices';
import { LoginPage } from './pages/Login';
import { MessagesPage } from './pages/Messages';
import { NotFoundPage, SignedOutNotFound } from './pages/NotFound';
import { ProjectDetailPage } from './pages/ProjectDetail';
import { ProjectsPage } from './pages/Projects';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/ResetPassword';
import { SettingsPage } from './pages/Settings';

/** Addresses that are real screens once signed in, so signed out they go to sign-in and not a 404. */
const isAppPath = (path: string) =>
  ['/', '/dashboard', '/projects', '/messages', '/documents', '/invoices', '/settings'].some(
    (base) => (base === '/' ? path === '/' : path === base || path.startsWith(`${base}/`)),
  );

export function App() {
  const { user, loading } = useAuth();

  // Session-lifetime socket, so the Messages badge stays live everywhere.
  useEffect(() => {
    if (user) {
      connectSocket();
      return () => disconnectSocket();
    }
    disconnectSocket();
    return undefined;
  }, [user]);

  // The emailed links work signed in or out: an invitation may open on a shared device.
  const { pathname } = useLocation();
  if (pathname === '/reset-password') return <ResetPasswordPage />;
  if (pathname === '/forgot-password' && !user) return <ForgotPasswordPage />;

  if (loading) {
    return (
      <div className="wallpaper flex min-h-dvh items-center justify-center">
        <LoadingState label="Signing you in…" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<SignedOutNotFound known={isAppPath} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
      <Route element={<PortalLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
