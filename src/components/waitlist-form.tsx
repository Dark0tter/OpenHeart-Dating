"use client";

import { FormEvent, useState } from "react";
import { BotCheck, botToken } from "@/components/bot-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WaitlistForm() {
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        city: fd.get("city"),
        state: fd.get("state"),
        country: fd.get("country"),
        botToken: botToken(fd),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(data.error ?? "Could not add you.");
    setDone(
      data.alreadyConfirmed
        ? "You're already on the list. We've updated your city."
        : "Almost done: check your email and tap Confirm.",
    );
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
        <Label htmlFor="waitEmail">Email</Label>
        <Input
          id="waitEmail"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={200}
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="waitCity">City</Label>
          <Input
            id="waitCity"
            name="city"
            autoComplete="address-level2"
            maxLength={80}
            required
          />
        </div>
        <div>
          <Label htmlFor="waitState">State or region</Label>
          <Input
            id="waitState"
            name="state"
            autoComplete="address-level1"
            maxLength={80}
          />
        </div>
        <div>
          <Label htmlFor="waitCountry">Country</Label>
          <Input
            id="waitCountry"
            name="country"
            autoComplete="country-name"
            maxLength={80}
          />
        </div>
      </div>
      <BotCheck />
      {error && (
        <p role="alert" className="text-sm text-coral-deep">
          {error}
        </p>
      )}
      <Button type="submit" disabled={sending}>
        {sending ? "Adding…" : "Tell me when it's ready"}
      </Button>
    </form>
  );
}
