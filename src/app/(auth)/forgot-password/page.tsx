"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { BotCheck, botToken } from "@/components/bot-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(fd.get("email")),
        botToken: botToken(fd),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setDone(data.message);
    else setError(data.error ?? "Something went wrong.");
  }

  return (
    <AuthShell subtitle="Reset your password.">
      {done ? (
        <p
          role="status"
          className="mt-8 rounded-md bg-mist px-3 py-3 text-sm text-forest"
        >
          {done}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="email">Email on your account</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <BotCheck />
          {error && (
            <p role="alert" className="text-sm text-coral-deep">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-sm text-ink/60">
        <Link href="/login" className="text-forest underline">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  );
}
