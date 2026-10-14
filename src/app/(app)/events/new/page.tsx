"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KINDS = [
  { value: "MUNCH", label: "Munch — casual meetup in a public place" },
  { value: "SOCIAL", label: "Social or party" },
  { value: "CLASS", label: "Class or workshop" },
  { value: "ONLINE", label: "Online" },
];

const TIERS = [
  {
    value: "STANDARD",
    label: "General — shown everywhere, including the apps",
  },
  {
    value: "ADULT_TEXT",
    label: "Adult themes — hidden in the apps unless members opt in",
  },
  { value: "WEB_ONLY", label: "Website only" },
];

const select =
  "h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3 text-sm";

export default function NewEventPage() {
  const router = useRouter();
  const [kind, setKind] = useState("MUNCH");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => {
      const v = String(fd.get(k) ?? "").trim();
      return v || null;
    };
    const capacity = str("capacity");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        tier: str("tier") ?? "STANDARD",
        title: str("title"),
        description: str("description"),
        startsAt: new Date(String(fd.get("startsAt"))).toISOString(),
        endsAt: str("endsAt")
          ? new Date(String(fd.get("endsAt"))).toISOString()
          : null,
        venueName: str("venueName"),
        address: str("address"),
        onlineUrl: str("onlineUrl"),
        city: str("city"),
        state: str("state"),
        country: str("country"),
        capacity: capacity ? Number(capacity) : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) router.push(`/events/${data.id}`);
    else setError(data.error ?? "Could not create the event.");
  }

  const online = kind === "ONLINE";

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Host an event
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        First munches should be in a public place like a café or bar. The exact
        address or link is only shown to people who RSVP &ldquo;going&rdquo;,
        and you can see who&apos;s coming.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="kind">Type</Label>
          <select
            id="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={select}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            required
            minLength={3}
            maxLength={120}
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            name="description"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            placeholder="Who it's for, what to expect, dress code, how to find the group…"
            className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="startsAt">Starts</Label>
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              required
            />
          </div>
          <div>
            <Label htmlFor="endsAt">Ends (optional)</Label>
            <Input id="endsAt" name="endsAt" type="datetime-local" />
          </div>
        </div>

        {online ? (
          <div>
            <Label htmlFor="onlineUrl">
              Meeting link (only shown to people going)
            </Label>
            <Input
              id="onlineUrl"
              name="onlineUrl"
              type="url"
              placeholder="https://"
            />
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="venueName">Venue name (shown to everyone)</Label>
              <Input
                id="venueName"
                name="venueName"
                maxLength={120}
                placeholder="e.g. Blue Door Café"
              />
            </div>
            <div>
              <Label htmlFor="address">
                Exact address (only shown to people going)
              </Label>
              <Input id="address" name="address" maxLength={300} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" required maxLength={80} />
              </div>
              <div>
                <Label htmlFor="state">State / region</Label>
                <Input id="state" name="state" maxLength={80} />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input id="country" name="country" maxLength={80} />
              </div>
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="capacity">Spaces (optional)</Label>
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              max={10000}
              inputMode="numeric"
            />
          </div>
          <div>
            <Label htmlFor="tier">Who can see it</Label>
            <select
              id="tier"
              name="tier"
              className={select}
              defaultValue="STANDARD"
            >
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-ink/70">
          No ticket sales, paid entry links or money requests — events are free
          to list and attend through OpenHeart. Follow the community guidelines.
        </p>
        {error && (
          <p role="alert" className="text-sm text-coral-deep">
            {error}
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Creating…" : "Create event"}
        </Button>
      </form>
    </div>
  );
}
