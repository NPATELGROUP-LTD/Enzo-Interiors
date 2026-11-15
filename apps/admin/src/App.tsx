import { Navigate, Outlet, Route, Routes, useLocation, useOutletContext, useParams } from 'react-router-dom';

import { AdminLayout, CLIENT_ROLES, CMS_ROLES, MAIL_ROLES, SECTIONS, TEAM_ROLES } from './components/layout/AdminLayout';
import { Button, LoadingState } from './components/ui';
import { useAuth } from './lib/auth';
import { legalKind } from './lib/legal';
import { CmsHome, CollectionPage, EntryPage } from './pages/Cms';
import { LegalPage } from './pages/Legal';
import { LoginPage } from './pages/Login';
import { NotFoundPage, SignedOutNotFound } from './pages/NotFound';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/ResetPassword';
import { AccountPage } from './pages/Account';
import { AppointmentsPage } from './pages/Appointments';
import { ClientDetailPage } from './pages/ClientDetail';
import { ClientsPage } from './pages/Clients';
import { DashboardPage } from './pages/Dashboard';
import { InfraDashboard } from './pages/InfraDashboard';
import { EnquiriesPage } from './pages/Enquiries';
import { InvoicesPage } from './pages/Invoices';
import { QuotesPage } from './pages/Quotes';
import { InventoryPage } from './pages/Inventory';
import { QuoteMakerPage } from './pages/QuoteMaker';
import { CataloguePage } from './components/inventory/Specs';
import { MailPage } from './pages/Mail';
import { MessagesPage } from './pages/Messages';
import { ProjectDetailPage } from './pages/ProjectDetail';
import { ProjectsPage } from './pages/Projects';
import { SiteSettingsPage } from './pages/SiteSettings';
import { TeamPage } from './pages/Team';
import type { CmsCollection } from './types/cms';

/** The slug comes from the address; keyed so each entry starts fresh. */
/** A guard route's Outlet: hands the layout's context on, which a bare <Outlet /> drops. */
function PassOn() {
  return <Outlet context={useOutletContext()} />;
}

function EntryRoute({ collection, basePath }: { collection: CmsCollection; basePath: string }) {
  const { slug = '' } = useParams();
  return <EntryPage key={slug} collection={collection} slug={slug} basePath={basePath} />;
}

/** Addresses that are real screens once signed in, so signed out they go to sign-in and not a 404. */
const isAppPath = (path: string) =>
  ['/', '/cms', '/account', '/settings', '/clients', '/projects', '/messages', '/team', '/mail', '/invoices', '/quotes', '/inventory', '/enquiries', '/bookings', ...SECTIONS.map(({ to }) => to)].some(
    (base) => (base === '/' ? path === '/' : path === base || path.startsWith(`${base}/`)),
  );

/**
 * v1 routes: the dashboard (the landing page for Admin and Designers; Editors
 * land on the CMS), the CMS, clients, projects, invoices, bookings, settings,
 * messages, your account and sign-in.
 */
export function App() {
  const { user, loading, logout, can } = useAuth();

  // Privacy, Terms and Cookies open signed in or out, so the sign-in screen can link to them.
  const legal = legalKind(useLocation().pathname);
  if (legal) return <LegalPage kind={legal} />;

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
        <Route path="*" element={<SignedOutNotFound known={isAppPath} />} />
      </Routes>
    );
  }

  // The API refuses these accounts anyway; saying so beats a screen of errors.
  if (user.kind !== 'Staff' || !['Admin', 'Infra', 'Editor', 'Designer', 'Installer'].includes(user.role)) {
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

  const canSeeClients = can(...CLIENT_ROLES);
  const canCms = can(...CMS_ROLES);
  // Where a page someone may not open sends them: their own landing page.
  const home = canSeeClients || user.role === 'Infra' ? '/' : '/cms';

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<AdminLayout />}>
        {/* Admin, Designers and Installers land on the dashboard; an Editor has none and lands on the CMS; an Infra manager on its own dashboard. */}
        <Route path="/" element={canSeeClients ? <DashboardPage /> : user.role === 'Infra' ? <InfraDashboard /> : <Navigate to={home} replace />} />
        <Route path="/account" element={<AccountPage />} />
        <Route
          path="/settings/:section?"
          element={user.role === 'Admin' || user.role === 'Infra' ? <SiteSettingsPage /> : <Navigate to={home} replace />}
        />
        {/* Admin, and Designers for the clients of their projects; never Editors. */}
        <Route path="/clients" element={canSeeClients ? <ClientsPage /> : <Navigate to={home} replace />} />
        <Route
          path="/clients/:id"
          element={canSeeClients ? <ClientDetailPage /> : <Navigate to={home} replace />}
        />
        {/* Same people: Admin, and Designers for the projects assigned to them. */}
        <Route path="/projects" element={canSeeClients ? <ProjectsPage /> : <Navigate to={home} replace />} />
        <Route
          path="/projects/:id"
          element={canSeeClients ? <ProjectDetailPage /> : <Navigate to={home} replace />}
        />
        <Route path="/messages" element={canSeeClients ? <MessagesPage /> : <Navigate to={home} replace />} />
        {/* Staff chat: the whole studio team, never Infra. */}
        <Route path="/team" element={can(...TEAM_ROLES) ? <TeamPage /> : <Navigate to={home} replace />} />
        {/* Your own Gmail: Admin, Designer, Editor. */}
        <Route path="/mail" element={can(...MAIL_ROLES) ? <MailPage /> : <Navigate to={home} replace />} />
        <Route
          path="/invoices"
          element={user.role === 'Admin' ? <InvoicesPage /> : <Navigate to={home} replace />}
        />
        <Route path="/quotes" element={user.role === 'Admin' ? <QuotesPage /> : <Navigate to={home} replace />} />
        <Route path="/quotes/:id" element={user.role === 'Admin' ? <QuotesPage /> : <Navigate to={home} replace />} />
        <Route path="/quote-maker" element={user.role === 'Admin' ? <QuoteMakerPage /> : <Navigate to={home} replace />} />
        <Route path="/quote-maker/:id" element={user.role === 'Admin' ? <QuoteMakerPage /> : <Navigate to={home} replace />} />
        <Route
          path="/inventory"
          element={user.role === 'Admin' ? <InventoryPage /> : user.role === 'Editor' ? <CataloguePage /> : <Navigate to={home} replace />}
        />
        <Route
          path="/enquiries"
          element={user.role === 'Admin' ? <EnquiriesPage /> : <Navigate to={home} replace />}
        />
        <Route
          path="/bookings"
          element={user.role === 'Admin' ? <AppointmentsPage /> : <Navigate to={home} replace />}
        />
        {/* The CMS: Admin and Editor only. */}
        <Route element={canCms ? <PassOn /> : <Navigate to="/" replace />}>
          <Route path="/cms" element={<CmsHome />} />
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
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
