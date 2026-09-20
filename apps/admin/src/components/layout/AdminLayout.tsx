import {
  Calculator,
  CalendarDots,
  ChatsCircle,
  GearSix,
  Globe,
  Invoice,
  Kanban,
  Layout,
  SquaresFour,
  UsersThree,
} from '@phosphor-icons/react';

import { Desktop, type DesktopApp } from './Desktop';

/**
 * Admin shell: the macOS-style desktop with the CRM's pages in the menu bar.
 *
 * The order is fixed by the UI/UX brief ("Dashboard, Clients, Bookings, Quotes
 * & Pricing, Projects, Invoices, Messages, Content and Settings") and by
 * websitemap.md §3. Do not reorder it for taste.
 *
 * "Website" is the CMS added in v1. The existing "Content" screen kept its
 * route but is now labelled "Enquiries", which is what it actually holds now
 * that testimonials and portfolio entries are edited in the CMS: contact-form
 * submissions from the public site.
 */
const APPS: DesktopApp[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: SquaresFour },
  { to: '/clients', label: 'Clients', Icon: UsersThree },
  { to: '/bookings', label: 'Bookings', Icon: CalendarDots },
  { to: '/quotes', label: 'Quotes & Pricing', Icon: Calculator },
  { to: '/projects', label: 'Projects', Icon: Kanban },
  { to: '/invoices', label: 'Invoices', Icon: Invoice },
  { to: '/messages', label: 'Messages', Icon: ChatsCircle, badge: true },
  { to: '/content', label: 'Enquiries', Icon: Globe },
  { to: '/website', label: 'Website', Icon: Layout },
  { to: '/settings', label: 'Settings', Icon: GearSix },
];

export function AdminLayout() {
  return <Desktop appName="Enzo Admin" apps={APPS} />;
}
