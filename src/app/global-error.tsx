"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h1>Something went wrong</h1>
        <p>We&apos;ve been notified and are looking into it.</p>
        <button type="button" onClick={reset} style={{ marginTop: 16 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
