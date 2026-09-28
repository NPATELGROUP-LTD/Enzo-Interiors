import type { Metadata } from "next";
import { NewsletterPage } from "../NewsletterPage";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default function UnsubscribePage() {
  return <NewsletterPage mode="unsubscribe" />;
}
