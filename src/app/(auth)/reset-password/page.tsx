"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password"));
    if (password !== String(fd.get("confirm"))) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) setDone(true);
    else setError(data.error ?? "Something went wrong.");
  }

  if (!token) {
    return (
      <p className="mt-8 text-sm text-ink/70">
        This link is missing its code.{" "}
        <Link href="/forgot-password" className="text-forest underline">
          Request a new reset link
        </Link>
        .
      </p>
    );
  }

  if (done) {
    return (
      <div role="status" className="mt-8 space-y-4">
        <p className="rounded-md bg-mist px-3 py-3 text-sm text-forest">
          Your password was changed and every device was signed out.
        </p>
        <Link href="/login" className="text-forest underline">
          Log in with your new password
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      <div>
        <Label htmlFor="confirm">Type it again</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-coral-deep">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell subtitle="Choose a new password.">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
