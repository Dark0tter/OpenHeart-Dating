"use client";

import { FormEvent, useState } from "react";
import { BotCheck, botToken } from "@/components/bot-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORT_CATEGORIES } from "@/lib/constants/support";

export function SupportForm({
  defaultEmail,
  inApp = false,
}: {
  defaultEmail: string;
  inApp?: boolean;
}) {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        category: fd.get("category"),
        subject: fd.get("subject"),
        body: fd.get("body"),
        botToken: botToken(fd),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) {
      setDone(
        `Thanks — we got it. Your reference is ${data.ticket}. We'll reply by email.`,
      );
    } else {
      setError(data.error ?? "Could not send your message.");
    }
  }

  if (done) {
    return (
      <p role="status" className="rounded-md bg-mist px-3 py-3 text-forest">
        {done}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="email">Your email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          required
        />
      </div>
      <div>
        <Label htmlFor="category">What is this about?</Label>
        <select
          id="category"
          name="category"
          required
          className="h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3 text-sm"
        >
          {SUPPORT_CATEGORIES.filter((c) => !inApp || c.id !== "billing").map(
            (c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ),
          )}
        </select>
      </div>
      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" maxLength={150} required />
      </div>
      <div>
        <Label htmlFor="body">Message</Label>
        <textarea
          id="body"
          name="body"
          rows={6}
          minLength={10}
          maxLength={5000}
          required
          className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
        />
      </div>
      <BotCheck />
      {error && (
        <p role="alert" className="text-sm text-coral-deep">
          {error}
        </p>
      )}
      <Button type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
