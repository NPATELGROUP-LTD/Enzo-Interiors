"use client";

// The withdrawal control, as a component so the cookie policy page and the
// footer can both carry one without either of them becoming a Client
// Component for the sake of one button.
//
// UK GDPR Art. 7(3): withdrawing consent must be as easy as giving it. A link
// to a policy page that then explains how to clear your browser storage is
// not as easy as clicking "Accept all" was — so this reopens the same notice,
// with the same two controls, from anywhere on the site.
import { reopenConsent } from "@/lib/consent";

export function CookieSettingsButton({
  className,
  children = "Cookie settings",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button type="button" onClick={() => reopenConsent()} className={className}>
      {children}
    </button>
  );
}
