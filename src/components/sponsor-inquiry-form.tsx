"use client";

import { FormEvent, useState } from "react";
import { BotCheck, botToken } from "@/components/bot-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SponsorInquiryForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/sponsors/inquiry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: fd.get("businessName"),
        contactName: fd.get("contactName"),
        email: fd.get("email"),
        website: fd.get("website"),
        city: fd.get("city"),
        message: fd.get("message"),
        botToken: botToken(fd),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) setDone(true);
    else setError(data.error ?? "Could not send your message.");
  }

  if (done) {
    return (
      <p role="status" className="rounded-md bg-mist px-3 py-3 text-forest">
        Thanks, we got it. A person will reply by email, usually within a few
        days.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="businessName">Business or organization</Label>
          <Input
            id="businessName"
            name="businessName"
            maxLength={120}
            required
          />
        </div>
        <div>
          <Label htmlFor="contactName">Your name</Label>
          <Input
            id="contactName"
            name="contactName"
            autoComplete="name"
            maxLength={120}
            required
          />
        </div>
        <div>
          <Label htmlFor="inquiryEmail">Email</Label>
          <Input
            id="inquiryEmail"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={200}
            required
          />
        </div>
        <div>
          <Label htmlFor="website">Website (optional)</Label>
          <Input
            id="website"
            name="website"
            type="url"
            placeholder="https://"
            maxLength={300}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="city">City or area you want to reach (optional)</Label>
        <Input id="city" name="city" maxLength={120} />
      </div>
      <div>
        <Label htmlFor="message">What would you like to promote?</Label>
        <textarea
          id="message"
          name="message"
          rows={5}
          minLength={10}
          maxLength={3000}
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
        {sending ? "Sending…" : "Send inquiry"}
      </Button>
    </form>
  );
}
