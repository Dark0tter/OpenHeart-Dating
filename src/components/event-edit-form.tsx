"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EditableEvent = {
  id: string;
  kind: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  address: string | null;
  onlineUrl: string | null;
  capacity: number | null;
};

/** `datetime-local` wants local time without a zone. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function EventEditForm({
  event,
  onDone,
}: {
  event: EditableEvent;
  onDone: (saved: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const online = event.kind === "ONLINE";

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const text = (k: string) => String(fd.get(k) ?? "").trim();
    const ends = text("endsAt");
    const capacity = text("capacity");
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: text("title"),
        description: text("description"),
        startsAt: new Date(text("startsAt")).toISOString(),
        endsAt: ends ? new Date(ends).toISOString() : null,
        capacity: capacity ? Number(capacity) : null,
        ...(online
          ? { onlineUrl: text("onlineUrl") || null }
          : {
              venueName: text("venueName") || null,
              address: text("address") || null,
            }),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't save. Please check the details.");
      return;
    }
    onDone(true);
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-lg border border-forest/15 bg-cream/60 p-4"
    >
      <h2 className="font-medium text-forest">Edit event</h2>
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={event.title}
          minLength={3}
          maxLength={120}
          required
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          defaultValue={event.description}
          minLength={10}
          maxLength={5000}
          required
          rows={6}
          className="mt-1 w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startsAt">Starts</Label>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={toLocalInput(event.startsAt)}
            required
          />
        </div>
        <div>
          <Label htmlFor="endsAt">Ends (optional)</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={toLocalInput(event.endsAt)}
          />
        </div>
      </div>
      {online ? (
        <div>
          <Label htmlFor="onlineUrl">Link (only people going see it)</Label>
          <Input
            id="onlineUrl"
            name="onlineUrl"
            type="url"
            defaultValue={event.onlineUrl ?? ""}
          />
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="venueName">Venue name</Label>
            <Input
              id="venueName"
              name="venueName"
              defaultValue={event.venueName ?? ""}
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="address">Address (only people going see it)</Label>
            <Input
              id="address"
              name="address"
              defaultValue={event.address ?? ""}
              maxLength={300}
            />
          </div>
        </>
      )}
      <div>
        <Label htmlFor="capacity">Capacity (optional)</Label>
        <Input
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          max={10000}
          defaultValue={event.capacity ?? ""}
        />
      </div>
      <p className="text-xs text-ink/70">
        If you change the time or place, everyone who RSVP&apos;d is told.
      </p>
      {error && (
        <p role="alert" className="text-sm text-coral-deep">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => onDone(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
