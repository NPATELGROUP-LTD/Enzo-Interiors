import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout/Layout";
import { HomePage } from "./components/pages/HomePage";
import { ServicesPage } from "./components/pages/ServicesPage";
import { ServiceDetailPage } from "./components/pages/ServiceDetailPage";
import { PortfolioPage } from "./components/pages/PortfolioPage";
import { AboutPage } from "./components/pages/AboutPage";
import { ContactPage } from "./components/pages/ContactPage";
import { BookingPage } from "./components/pages/BookingPage";
import { NotFoundPage } from "./components/pages/NotFoundPage";
import { PortalLogin } from "./components/portal/PortalLogin";
import { PortalLayout } from "./components/portal/PortalLayout";
import { PortalDashboard } from "./components/portal/PortalDashboard";
import { PortalProjects } from "./components/portal/PortalProjects";
import { PortalProjectDetail } from "./components/portal/PortalProjectDetail";
import { PortalMessages } from "./components/portal/PortalMessages";
import { PortalDocuments } from "./components/portal/PortalDocuments";
import { PortalInvoices } from "./components/portal/PortalInvoices";
import { PortalSettings } from "./components/portal/PortalSettings";
import { AdminLogin } from "./components/portal/AdminLogin";
import { AdminLayout } from "./components/portal/AdminLayout";
import { AdminDashboard } from "./components/portal/AdminDashboard";
import { AdminClients } from "./components/portal/AdminClients";
import { AdminClientDetail } from "./components/portal/AdminClientDetail";
import { AdminBookings } from "./components/portal/AdminBookings";
import { AdminProjects } from "./components/portal/AdminProjects";
import { AdminInvoices } from "./components/portal/AdminInvoices";
import { AdminMessages } from "./components/portal/AdminMessages";
import { AdminSettings } from "./components/portal/AdminSettings";
import { AdminContentManager } from "./components/portal/AdminContentManager";
import { AdminContactSubmissions } from "./components/portal/AdminContactSubmissions";
import { AdminTestimonials } from "./components/portal/AdminTestimonials";

export const router = createBrowserRouter([
  // Marketing Website
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: "services", Component: ServicesPage },
      { path: "services/:slug", Component: ServiceDetailPage },
      { path: "portfolio", Component: PortfolioPage },
      { path: "about", Component: AboutPage },
      { path: "contact", Component: ContactPage },
    ],
  },
  // Booking (standalone layout)
  { path: "/booking", Component: BookingPage },
  // Portal: login at /portal, child pages under /portal/*
  {
    path: "/portal",
    children: [
      { index: true, Component: PortalLogin },
      { path: "login", Component: PortalLogin },
      {
        Component: PortalLayout,
        children: [
          { path: "dashboard", Component: PortalDashboard },
          { path: "projects", Component: PortalProjects },
          { path: "projects/:id", Component: PortalProjectDetail },
          { path: "messages", Component: PortalMessages },
          { path: "documents", Component: PortalDocuments },
          { path: "invoices", Component: PortalInvoices },
          { path: "settings", Component: PortalSettings },
        ],
      },
    ],
  },
  // Admin Panel
  {
    path: "/admin",
    children: [
      { path: "login", Component: AdminLogin },
      {
        Component: AdminLayout,
        children: [
          { index: true, Component: AdminDashboard },
          { path: "dashboard", Component: AdminDashboard },
          { path: "clients", Component: AdminClients },
          { path: "clients/:id", Component: AdminClientDetail },
          { path: "bookings", Component: AdminBookings },
          { path: "projects", Component: AdminProjects },
          { path: "invoices", Component: AdminInvoices },
          { path: "messages", Component: AdminMessages },
          { path: "settings", Component: AdminSettings },
          { path: "content", Component: AdminContentManager },
          { path: "contact-submissions", Component: AdminContactSubmissions },
          { path: "testimonials", Component: AdminTestimonials },
        ],
      },
    ],
  },
  // 404
  { path: "*", Component: NotFoundPage },
]);
