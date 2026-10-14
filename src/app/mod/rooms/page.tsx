import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { roomHostAction } from "@/app/mod/actions";

export const dynamic = "force-dynamic";

const btn =
  "rounded-md border border-forest/20 px-2 py-1 text-xs hover:bg-mist";

export default async function RoomsAdmin() {
  const rooms = await prisma.chatRoom.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { members: true, bans: true } },
      members: {
        where: { isHost: true },
        select: {
          userId: true,
          user: {
            select: { email: true, profile: { select: { displayName: true } } },
          },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Rooms &amp; hosts
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Hosts can pin notices, set rules and slow mode, delete messages, and
        mute or remove members in their room. They can&apos;t act on other hosts
        or staff. Everything they do is in the audit log.
      </p>
      <ul className="mt-6 space-y-4">
        {rooms.map((r) => (
          <li key={r.id} className="rounded-lg border border-forest/10 p-4">
            <p className="font-medium text-forest">
              {r.name}{" "}
              <span className="text-sm font-normal text-ink/60">
                · {r._count.members} members · {r._count.bans} removed
              </span>
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {r.members.map((h) => (
                <li key={h.userId} className="flex items-center gap-2">
                  <Link
                    href={`/mod/users/${h.userId}`}
                    className="text-forest underline"
                  >
                    {h.user.profile?.displayName ?? h.user.email}
                  </Link>
                  <form action={roomHostAction}>
                    <input type="hidden" name="roomId" value={r.id} />
                    <input type="hidden" name="userId" value={h.userId} />
                    <button name="action" value="remove_host" className={btn}>
                      Remove host
                    </button>
                  </form>
                </li>
              ))}
              {r.members.length === 0 && (
                <li className="text-ink/50">No hosts yet.</li>
              )}
            </ul>
            <form action={roomHostAction} className="mt-2 flex gap-2">
              <input type="hidden" name="roomId" value={r.id} />
              <input
                name="email"
                type="email"
                required
                placeholder="Member email (must have joined)"
                aria-label={`Appoint host for ${r.name}`}
                className="h-8 w-72 rounded-md border border-forest/15 bg-cream/80 px-2 text-sm"
              />
              <button name="action" value="make_host" className={btn}>
                Make host
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
