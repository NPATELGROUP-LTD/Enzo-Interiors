import {
  Armchair,
  ChatsCircle,
  FileText,
  Files,
  GearSix,
  House,
  Invoice,
} from '@phosphor-icons/react';

import { Desktop, type DesktopApp } from './Desktop';

/**
 * Client Portal shell: the client's pages, in the menu bar from lg up and in
 * the bottom bar below it. The order is the bottom bar's: what fits shows as
 * icons, the rest go under More.
 */
const APPS: DesktopApp[] = [
  { to: '/dashboard', label: 'Home', Icon: House },
  { to: '/projects', label: 'Projects', Icon: Armchair },
  { to: '/messages', label: 'Messages', Icon: ChatsCircle, badge: true },
  { to: '/documents', label: 'Documents', Icon: Files },
  { to: '/quotes', label: 'Quotes', Icon: FileText },
  { to: '/invoices', label: 'Invoices', Icon: Invoice },
  { to: '/settings', label: 'Settings', Icon: GearSix },
];

export function PortalLayout() {
  return <Desktop appName="Enzo Interiors" apps={APPS} />;
}
