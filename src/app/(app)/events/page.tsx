"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatWhen, KIND_SHORT, type EventKindId } from "@/lib/event-format";

type EventCard = {
  id: string;
  kind: EventKindId;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  city: string | null;
  state: string | null;
  going: number;
  full: boolean;
  km: number | null;
  host: { id: string; displayName: string };
  isHost: boolean;
  yourRsvp: string | null;
};

const SCOPES = [
  { id: "upcoming", label: "All upcoming" },
  { id: "nearby", label: "Near me" },
  { id: "online", label: "Online" },
  { id: "mine", label: "Hosting & going" },
] as const;

export default function EventsPage() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]["id"]>("upcoming");
  const [events, setEvents] = useState<EventCard[] | null>(null);
  const [hasLocation, setHasLocation] = useState(true);

  useEffect(() => {
    setEvents(null);
    fetch(`/api/events?scope=${scope}`)
      .then((r) => r.json())
      .then((d) => {
        setEvents(d.events ?? []);
        setHasLocation(d.hasLocation ?? true);
      });
  }, [scope]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          Events
        </h1>
        <Link href="/events/new">
          <Button type="button">Host an event</Button>
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        Munches, socials, classes and online meetups run by members. Exact
        addresses are only shared with people who RSVP &ldquo;going&rdquo;.
      </p>

      <div
        role="tablist"
        aria-label="Which events"
        className="mt-6 flex flex-wrap gap-2"
      >
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={scope === s.id}
            onClick={() => setScope(s.id)}
            className={
              scope === s.id
                ? "rounded-md bg-forest px-3 py-1.5 text-sm text-cream"
                : "rounded-md bg-mist px-3 py-1.5 text-sm text-forest hover:bg-sage/30"
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {scope === "nearby" && !hasLocation && (
        <p className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-forest">
          <Link href="/onboarding#location" className="underline">
            Set your location
          </Link>{" "}
          to see events near you.
        </p>
      )}

      {events === null ? (
        <p className="mt-8 text-ink/60">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-8 text-ink/60">
          No events here yet. Why not{" "}
          <Link href="/events/new" className="text-forest underline">
            host one
          </Link>
          ? A coffee munch is an easy start.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                className="block h-full rounded-lg border border-forest/10 bg-cream/70 p-4 hover:shadow-sm"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-sage">
                  {KIND_SHORT[e.kind]} · {formatWhen(e.startsAt, e.endsAt)}
                </p>
                <h2 className="mt-1 font-[family-name:var(--font-fraunces)] text-xl text-forest">
                  {e.title}
                </h2>
                <p className="mt-1 text-sm text-ink/65">
                  {e.kind === "ONLINE"
                    ? "Online"
                    : [e.venueName, e.city, e.state].filter(Boolean).join(", ")}
                  {e.km != null && ` · about ${e.km} km away`}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-ink/75">
                  {e.description}
                </p>
                <p className="mt-3 text-xs text-ink/55">
                  Hosted by {e.isHost ? "you" : e.host.displayName} · {e.going}{" "}
                  going
                  {e.full && " · full"}
                  {e.yourRsvp && !e.isHost && ` · you're ${e.yourRsvp}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
