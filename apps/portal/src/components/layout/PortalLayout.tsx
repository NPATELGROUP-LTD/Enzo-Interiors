import {
  Armchair,
  Calculator,
  ChatsCircle,
  Files,
  GearSix,
  House,
  Invoice,
} from '@phosphor-icons/react';

import { Desktop, type DesktopApp } from './Desktop';

/**
 * Client Portal shell: the macOS-style desktop with the client's pages in the
 * menu bar.
 */
const APPS: DesktopApp[] = [
  { to: '/dashboard', label: 'Dashboard', Icon: House },
  { to: '/projects', label: 'Projects', Icon: Armchair },
  { to: '/messages', label: 'Messages', Icon: ChatsCircle, badge: true },
  { to: '/invoices', label: 'Invoices', Icon: Invoice },
  { to: '/quotes', label: 'My Quotes', Icon: Calculator },
  { to: '/documents', label: 'Documents', Icon: Files },
  { to: '/settings', label: 'Settings', Icon: GearSix },
];

export function PortalLayout() {
  return <Desktop appName="Enzo Interiors" apps={APPS} />;
}
