import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import { AdminLayout, SECTIONS } from './components/layout/AdminLayout';
import { Button, LoadingState } from './components/ui';
import { useAuth } from './lib/auth';
import { CmsHome, CollectionPage, EntryPage } from './pages/Cms';
import { LoginPage } from './pages/Login';
import { NotFoundPage } from './pages/NotFound';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/ResetPassword';
import { AccountPage } from './pages/Account';
import { AppointmentsPage } from './pages/Appointments';
import { SiteSettingsPage } from './pages/SiteSettings';
import type { CmsCollection } from './types/cms';

/** The slug comes from the address; keyed so each entry starts fresh. */
function EntryRoute({ collection, basePath }: { collection: CmsCollection; basePath: string }) {
  const { slug = '' } = useParams();
  return <EntryPage key={slug} collection={collection} slug={slug} basePath={basePath} />;
}

/**
 * v1 routes: the CMS, bookings, settings, your account and sign-in.
 *
 * The CRM screens in src/pages (Dashboard, Clients, Bookings, Quotes,
 * Projects, Invoices, Messages, Enquiries, Settings) are kept but not routed:
 * the v1 API does not mount their modules, so every one of them would open on
 * a 404. Routing them again goes hand in hand with re-importing the modules in
 * apps/api/src/app.module.ts.
 */
export function App() {
  const { user, loading, logout } = useAuth();

  // Wait for /auth/me before deciding — otherwise a refresh on a deep link
  // flashes the login screen before bouncing back.
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
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // The API refuses these accounts anyway; saying so beats a screen of errors.
  if (user.kind !== 'Staff' || !['Admin', 'Editor', 'Designer'].includes(user.role)) {
    return (
      <div className="wallpaper flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="max-w-sm text-ink">
          {user.name}, your account has no access here yet. Ask an administrator.
        </p>
        <Button variant="secondary" onClick={logout}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/cms" replace />} />
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/cms" replace />} />
        <Route path="/cms" element={<CmsHome />} />
        <Route path="/account" element={<AccountPage />} />
        <Route
          path="/settings/:section?"
          element={user.role === 'Admin' ? <SiteSettingsPage /> : <Navigate to="/cms" replace />}
        />
        <Route
          path="/bookings"
          element={user.role === 'Admin' ? <AppointmentsPage /> : <Navigate to="/cms" replace />}
        />
        {SECTIONS.flatMap(({ to, collection }) =>
          // The overview lists every page, so there is no separate page list;
          // and Company is one record, so it opens straight onto it.
          collection === 'pages'
            ? [
                <Route key={to} path={to} element={<Navigate to="/cms" replace />} />,
                <Route
                  key={`${to}/:slug`}
                  path={`${to}/:slug`}
                  element={<EntryRoute collection="pages" basePath={to} />}
                />,
              ]
            : collection === 'company'
            ? [
                <Route
                  key={to}
                  path={to}
                  element={<EntryPage collection="company" slug="company" basePath={to} />}
                />,
              ]
            : [
                <Route
                  key={to}
                  path={to}
                  element={
                    <CollectionPage key={collection} collection={collection} basePath={to} />
                  }
                />,
                <Route
                  key={`${to}/:slug`}
                  path={`${to}/:slug`}
                  element={<EntryRoute collection={collection} basePath={to} />}
                />,
              ],
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
