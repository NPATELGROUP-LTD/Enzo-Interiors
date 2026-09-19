import {
  Calculator,
  CalendarDots,
  ChatsCircle,
  GearSix,
  Globe,
  Invoice,
  Kanban,
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
 */
const APPS: DesktopApp[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: SquaresFour },
  { to: '/clients', label: 'Clients', Icon: UsersThree },
  { to: '/bookings', label: 'Bookings', Icon: CalendarDots },
  { to: '/quotes', label: 'Quotes & Pricing', Icon: Calculator },
  { to: '/projects', label: 'Projects', Icon: Kanban },
  { to: '/invoices', label: 'Invoices', Icon: Invoice },
  { to: '/messages', label: 'Messages', Icon: ChatsCircle, badge: true },
  { to: '/content', label: 'Content', Icon: Globe },
  { to: '/settings', label: 'Settings', Icon: GearSix },
];

export function AdminLayout() {
  return <Desktop appName="Enzo Admin" apps={APPS} />;
}
