import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { upcomingWhere } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function EventsAdmin() {
  const events = await prisma.event.findMany({
    where: upcomingWhere(),
    orderBy: { startsAt: "asc" },
    take: 200,
    include: {
      host: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true } },
        },
      },
      _count: { select: { rsvps: true } },
    },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Upcoming events
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        Open an event to cancel it; you&apos;ll be asked for a reason, which is
        logged, and everyone who RSVP&apos;d is told.
      </p>
      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-ink/70">
          <tr>
            <th className="py-2">When (UTC)</th>
            <th>Event</th>
            <th>Host</th>
            <th>Where</th>
            <th>RSVPs</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-forest/10">
              <td className="py-2 whitespace-nowrap">
                {e.startsAt.toISOString().slice(0, 16).replace("T", " ")}
              </td>
              <td>
                <Link
                  href={`/events/${e.id}`}
                  className="text-forest underline"
                >
                  {e.title}
                </Link>{" "}
                <span className="text-xs text-ink/70">
                  {e.kind.toLowerCase()} ·{" "}
                  {e.tier.toLowerCase().replace("_", " ")}
                </span>
              </td>
              <td>
                <Link
                  href={`/mod/users/${e.host.id}`}
                  className="text-forest underline"
                >
                  {e.host.profile?.displayName ?? e.host.email}
                </Link>
              </td>
              <td>
                {e.kind === "ONLINE"
                  ? "online"
                  : [e.city, e.country].filter(Boolean).join(", ")}
              </td>
              <td>{e._count.rsvps}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {events.length === 0 && (
        <p className="mt-6 text-ink/70">No upcoming events.</p>
      )}
    </div>
  );
}
