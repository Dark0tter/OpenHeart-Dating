"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountSecurity() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setBusy(false);
    if (res.ok) {
      await signOut({ callbackUrl: "/login?changed=1" });
      return;
    }
    const data = await res.json().catch(() => ({}));
    setMsg(data.error ?? "Couldn't change your password.");
  }

  async function onSignOutEverywhere() {
    const res = await fetch("/api/account/sessions", { method: "DELETE" });
    if (res.ok) await signOut({ callbackUrl: "/login" });
  }

  return (
    <section className="space-y-4" aria-labelledby="security-heading">
      <h2 id="security-heading" className="font-medium text-forest">
        Password and devices
      </h2>
      <form onSubmit={onChangePassword} className="space-y-3">
        <div>
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </div>
        {msg && (
          <p role="alert" className="text-sm text-coral-deep">
            {msg}
          </p>
        )}
        <Button type="submit" variant="secondary" disabled={busy}>
          Change password
        </Button>
        <p className="text-sm text-ink/70">
          Changing your password signs you out on every device.
        </p>
      </form>
      <div className="space-y-1">
        <Link
          href="/settings/two-step"
          className="text-sm text-forest underline"
        >
          Two-step sign-in
        </Link>
        <p className="text-sm text-ink/70">
          Ask for a code from your phone as well as your password.
        </p>
      </div>
      <div className="space-y-2">
        <Button type="button" variant="ghost" onClick={onSignOutEverywhere}>
          Sign out on all devices
        </Button>
        <p className="text-sm text-ink/70">
          Use this if you lost a phone or signed in on a shared computer.
        </p>
      </div>
    </section>
  );
}
