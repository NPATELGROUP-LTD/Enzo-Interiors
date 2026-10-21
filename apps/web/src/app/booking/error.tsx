"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function BookingError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorView
      {...props}
      title="Booking is not loading right now."
      message="Try again in a moment. Or call or email us and we will arrange your free consultation directly."
    />
  );
}
