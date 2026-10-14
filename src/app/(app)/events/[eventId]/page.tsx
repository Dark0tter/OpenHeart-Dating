"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatWhen, KIND_SHORT, type EventKindId } from "@/lib/event-format";

type EventDetail = {
  id: string;
  kind: EventKindId;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  venueName: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  address: string | null;
  onlineUrl: string | null;
  hasPrivateDetails: boolean;
  capacity: number | null;
  going: number;
  interested: number;
  full: boolean;
  cancelled: boolean;
  km: number | null;
  host: { id: string; displayName: string };
  isHost: boolean;
  yourRsvp: "going" | "interested" | null;
};

type Attendee = { userId: string; displayName: string; status: string };

export default function EventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [attendees, setAttendees] = useState<Attendee[] | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Event not found");
      return;
    }
    setEvent(data.event);
    setAttendees(data.attendees);
    setCanModerate(data.canModerate);
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function rsvp(status: "going" | "interested" | null) {
    setNotice(null);
    const res = await fetch(`/api/events/${eventId}/rsvp`, {
      method: status ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: status ? JSON.stringify({ status }) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.error ?? "That didn't work.");
      return;
    }
    await load();
  }

  async function cancel() {
    const reason =
      canModerate && !event?.isHost
        ? prompt("Reason for cancelling (logged):")
        : "";
    if (reason === null) return;
    if (!confirm("Cancel this event? Everyone who RSVP'd will be told."))
      return;
    const res = await fetch(`/api/events/${eventId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) router.push("/events");
  }

  if (error) return <p className="text-ink/60">{error}</p>;
  if (!event) return <p className="text-ink/60">Loading…</p>;

  const place =
    event.kind === "ONLINE"
      ? "Online"
      : [event.venueName, event.city, event.state, event.country]
          .filter(Boolean)
          .join(", ");

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/events" className="text-sm text-forest underline">
          ← Events
        </Link>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-sage">
          {KIND_SHORT[event.kind]}
          {event.cancelled && " · cancelled"}
        </p>
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          {event.title}
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          {formatWhen(event.startsAt, event.endsAt)}
        </p>
        <p className="text-sm text-ink/70">
          {place}
          {event.km != null && ` · about ${event.km} km away`}
        </p>
        <p className="mt-1 text-sm text-ink/60">
          Hosted by{" "}
          {event.isHost ? (
            "you"
          ) : (
            <Link
              href={`/members/${event.host.id}`}
              className="text-forest underline"
            >
              {event.host.displayName}
            </Link>
          )}{" "}
          · {event.going} going
          {event.capacity != null && ` of ${event.capacity}`} ·{" "}
          {event.interested} interested
        </p>
      </div>

      {(event.address || event.onlineUrl) && (
        <div className="rounded-md border border-sage/40 bg-sage/10 px-4 py-3 text-sm">
          <p className="font-medium text-forest">Details for people going</p>
          {event.address && <p className="mt-1">{event.address}</p>}
          {event.onlineUrl && (
            <a
              href={event.onlineUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-1 block break-all text-forest underline"
            >
              {event.onlineUrl}
            </a>
          )}
        </div>
      )}
      {!event.address &&
        !event.onlineUrl &&
        event.hasPrivateDetails &&
        !event.cancelled && (
          <p className="rounded-md bg-mist px-3 py-2 text-sm text-forest">
            The exact {event.kind === "ONLINE" ? "link" : "address"} appears
            here once you RSVP &ldquo;going&rdquo;.
          </p>
        )}

      <p className="whitespace-pre-wrap text-ink/80">{event.description}</p>

      {notice && (
        <p
          role="status"
          className="rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {notice}
        </p>
      )}

      {!event.cancelled && !event.isHost && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={event.yourRsvp === "going" ? "primary" : "secondary"}
            disabled={event.full && event.yourRsvp !== "going"}
            aria-pressed={event.yourRsvp === "going"}
            onClick={() => rsvp("going")}
          >
            {event.full && event.yourRsvp !== "going" ? "Full" : "Going"}
          </Button>
          <Button
            type="button"
            variant={event.yourRsvp === "interested" ? "primary" : "secondary"}
            aria-pressed={event.yourRsvp === "interested"}
            onClick={() => rsvp("interested")}
          >
            Interested
          </Button>
          {event.yourRsvp && (
            <Button type="button" variant="ghost" onClick={() => rsvp(null)}>
              Remove RSVP
            </Button>
          )}
          <Link
            href={`/settings?report=${event.host.id}`}
            className="inline-flex h-10 items-center px-3 text-sm text-coral-deep hover:underline"
          >
            Report
          </Link>
        </div>
      )}

      {attendees && (
        <section>
          <h2 className="font-medium text-forest">
            Who&apos;s coming (only you can see this)
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {attendees.map((a) => (
              <li key={a.userId}>
                <Link
                  href={`/members/${a.userId}`}
                  className="text-forest underline"
                >
                  {a.displayName}
                </Link>{" "}
                <span className="text-ink/55">· {a.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!event.cancelled && (event.isHost || canModerate) && (
        <Button type="button" variant="danger" onClick={cancel}>
          Cancel event
        </Button>
      )}

      <p className="text-xs text-ink/50">
        Meeting someone new? Read our{" "}
        <Link href="/safety" className="underline">
          safety tips
        </Link>
        .
      </p>
    </div>
  );
}
