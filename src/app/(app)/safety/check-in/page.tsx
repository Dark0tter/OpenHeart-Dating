"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CheckIn = {
  id: string;
  meetingWith: string;
  place: string;
  startsAt: string;
  checkInBy: string;
  contactName: string;
  status: "active" | "safe" | "alerted" | "cancelled";
  alertFailedAt?: string | null;
};

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CheckInPage() {
  const [items, setItems] = useState<CheckIn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/safety/check-ins");
    if (res.ok) setItems((await res.json()).checkIns);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
    setError(null);
    const res = await fetch("/api/safety/check-ins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingWith: fd.get("meetingWith"),
        place: fd.get("place"),
        startsAt: new Date(String(fd.get("startsAt"))).toISOString(),
        checkInBy: new Date(String(fd.get("checkInBy"))).toISOString(),
        contactName: fd.get("contactName"),
        contactEmail: fd.get("contactEmail"),
        note: String(fd.get("note") ?? "") || undefined,
        tellContactNow: fd.get("tellContactNow") === "on",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Could not set up the check-in.");
      return;
    }
    form.reset();
    setNotice("Check-in set. We'll remind you when it's time.");
    load();
  }

  async function act(id: string, action: "safe" | "cancel" | "extend") {
    const res = await fetch("/api/safety/check-ins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, minutes: 60 }),
    });
    if (res.ok) {
      setNotice(
        action === "safe"
          ? "Glad you're safe!"
          : action === "extend"
            ? "Extended by an hour."
            : "Check-in cancelled.",
      );
      load();
    }
  }

  const now = new Date();
  const live = items.filter(
    (i) => i.status === "active" || i.status === "alerted",
  );

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          Date check-in
        </h1>
        <p className="mt-1 text-sm text-ink/70">
          Tell us when you expect to be home. If you don&apos;t tap
          &ldquo;I&apos;m safe&rdquo; within 15 minutes of that time, we email
          someone you trust with the details you enter here. See more{" "}
          <Link href="/safety" className="underline">
            safety tips
          </Link>
          .
        </p>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {notice}
        </p>
      )}

      {live.map((c) => (
        <section
          key={c.id}
          className={`rounded-lg border p-4 ${c.status === "alerted" ? "border-coral bg-coral/10" : "border-sage/50 bg-sage/10"}`}
        >
          <p className="font-medium text-forest">
            Meeting {c.meetingWith} at {c.place}
          </p>
          <p className="text-sm text-ink/70">
            {c.status === "alerted"
              ? `We emailed ${c.contactName} because you didn't check in.`
              : c.alertFailedAt
                ? `We couldn't email ${c.contactName} yet and are still trying. If you need help, call them or local emergency services.`
                : `Check in by ${new Date(c.checkInBy).toLocaleString()} or we'll email ${c.contactName}.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => act(c.id, "safe")}>
              I&apos;m safe
            </Button>
            {c.status === "active" && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => act(c.id, "extend")}
                >
                  Give me another hour
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => act(c.id, "cancel")}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </section>
      ))}

      <form
        onSubmit={create}
        className="space-y-4 rounded-lg border border-forest/10 bg-cream/60 p-4"
      >
        <h2 className="font-medium text-forest">Set up a check-in</h2>
        <div>
          <Label htmlFor="meetingWith">Who you&apos;re meeting</Label>
          <Input
            id="meetingWith"
            name="meetingWith"
            required
            maxLength={200}
            placeholder="Name, and their profile name if different"
          />
        </div>
        <div>
          <Label htmlFor="place">Where</Label>
          <Input
            id="place"
            name="place"
            required
            maxLength={300}
            placeholder="Venue and address"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="startsAt">Date starts</Label>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={localInput(now)}
            />
          </div>
          <div>
            <Label htmlFor="checkInBy">Check in by</Label>
            <Input
              id="checkInBy"
              name="checkInBy"
              type="datetime-local"
              required
              defaultValue={localInput(new Date(now.getTime() + 3 * 3600_000))}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="contactName">Trusted contact&apos;s name</Label>
            <Input
              id="contactName"
              name="contactName"
              required
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="contactEmail">Their email</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              required
              maxLength={200}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="note">
            Anything else they should know (optional)
          </Label>
          <textarea
            id="note"
            name="note"
            rows={2}
            maxLength={1000}
            className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="tellContactNow" defaultChecked /> Let
          them know now that they&apos;re my safety contact
        </label>
        <p className="text-xs text-ink/70">
          We only use these details for this check-in and delete them a week
          after it ends.
        </p>
        {error && (
          <p role="alert" className="text-sm text-coral-deep">
            {error}
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Start check-in"}
        </Button>
      </form>
    </div>
  );
}
