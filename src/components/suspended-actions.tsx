"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AppealForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch("/api/appeals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setSending(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Could not send your appeal.");
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Label htmlFor="appeal">Appeal this decision</Label>
      <textarea
        id="appeal"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        minLength={20}
        maxLength={4000}
        required
        placeholder="Tell us what happened and why you think the suspension is a mistake."
        className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
      />
      {error && (
        <p role="alert" className="text-sm text-coral-deep">
          {error}
        </p>
      )}
      <Button type="submit" disabled={sending || message.trim().length < 20}>
        {sending ? "Sending…" : "Send appeal"}
      </Button>
    </form>
  );
}

export function SuspendedAccountActions() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function remove(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, confirm }),
    });
    if (res.ok) {
      await signOut({ callbackUrl: "/?deleted=1" });
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Could not delete your account.");
  }

  return (
    <div className="space-y-4">
      <details className="rounded-md border border-forest/10 px-3 py-2">
        <summary className="cursor-pointer text-forest">
          Delete my account instead
        </summary>
        <form onSubmit={remove} className="mt-3 space-y-3">
          <div>
            <Label htmlFor="deletePassword">Password</Label>
            <Input
              id="deletePassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="deleteConfirm">Type DELETE to confirm</Label>
            <Input
              id="deleteConfirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-coral-deep">
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="secondary"
            disabled={confirm !== "DELETE" || !password}
          >
            Delete my account
          </Button>
        </form>
      </details>
      <Button
        type="button"
        variant="ghost"
        onClick={() => signOut({ callbackUrl: "/" })}
      >
        Sign out
      </Button>
    </div>
  );
}
