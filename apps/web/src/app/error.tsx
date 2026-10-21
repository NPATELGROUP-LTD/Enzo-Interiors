"use client";

import { ErrorView } from "@/components/shared/ErrorView";

export default function Error(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <ErrorView
      {...props}
      title="This page did not load."
      message="That was on our side, not yours. Try again in a moment, or get in touch and we will help directly."
    />
  );
}
