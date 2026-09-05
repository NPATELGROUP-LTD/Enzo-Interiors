import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { PortalLayout } from './components/layout/PortalLayout';
import { LoadingState } from './components/ui';
import { useAuth } from './lib/auth';
import { connectSocket, disconnectSocket } from './lib/socket';
import { DashboardPage } from './pages/Dashboard';
import { DocumentsPage } from './pages/Documents';
import { InvoicesPage } from './pages/Invoices';
import { LoginPage } from './pages/Login';
import { MessagesPage } from './pages/Messages';
import { NotFoundPage } from './pages/NotFound';
import { ProjectDetailPage } from './pages/ProjectDetail';
import { ProjectsPage } from './pages/Projects';
import { QuotesPage } from './pages/Quotes';
import { SettingsPage } from './pages/Settings';

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

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <LoadingState label="Signing you in…" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
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
        <Route path="/quotes" element={<QuotesPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
