import type { Metadata } from "next";
import { NewsletterPage } from "../NewsletterPage";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false, follow: false } };

export default function ConfirmPage() {
  return <NewsletterPage mode="confirm" />;
}
