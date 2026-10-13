"use client";

import { useState } from "react";

export function EmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    const res = await fetch("/api/auth/verify-email", { method: "POST" });
    if (res.ok) {
      setState("sent");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Couldn't send the email.");
      setState("error");
    }
  }

  return (
    <div
      role="status"
      className="border-b border-forest/10 bg-mist/80 px-4 py-2 text-sm text-forest"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          Please confirm your email. We sent a link to <strong>{email}</strong>.
        </span>
        {state === "sent" ? (
          <span>Sent. Check your inbox and spam folder.</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={state === "sending"}
            className="underline disabled:opacity-50"
          >
            {state === "sending" ? "Sending…" : "Send it again"}
          </button>
        )}
        {state === "error" && <span className="text-coral-deep">{error}</span>}
      </div>
    </div>
  );
}
