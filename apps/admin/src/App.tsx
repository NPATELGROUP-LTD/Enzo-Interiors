import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AdminLayout } from './components/layout/AdminLayout';
import { LoadingState } from './components/ui';
import { useAuth } from './lib/auth';
import { connectSocket, disconnectSocket } from './lib/socket';
import { BookingsPage } from './pages/Bookings';
import { ClientDetailPage } from './pages/ClientDetail';
import { ClientsPage } from './pages/Clients';
import { ContentPage } from './pages/Content';
import { DashboardPage } from './pages/Dashboard';
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

  // The socket's lifetime is the session's. Opening it here rather than in the
  // Messages screen means the unread badge stays live everywhere.
  useEffect(() => {
    if (user) {
      connectSocket();
      return () => disconnectSocket();
    }
    disconnectSocket();
    return undefined;
  }, [user]);

  // Wait for /auth/me before deciding — otherwise a refresh on a deep link
  // flashes the login screen before bouncing back.
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
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/quotes" element={<QuotesPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/content" element={<ContentPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
