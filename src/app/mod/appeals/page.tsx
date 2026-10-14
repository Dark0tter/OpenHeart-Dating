import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appealAction } from "@/app/mod/actions";

export const dynamic = "force-dynamic";

const btn =
  "rounded-md border border-forest/20 px-3 py-1.5 text-sm hover:bg-mist";

export default async function AppealsPage() {
  const appeals = await prisma.appeal.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          statusReason: true,
          suspendedUntil: true,
          profile: { select: { displayName: true } },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Appeals
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        You can&apos;t decide an appeal on a suspension you made. Your note is
        emailed to the member.
      </p>
      <ul className="mt-6 space-y-6">
        {appeals.map((a) => (
          <li key={a.id} className="rounded-lg border border-forest/10 p-4">
            <p className="text-sm">
              <Link
                href={`/mod/users/${a.user.id}`}
                className="text-forest underline"
              >
                {a.user.profile?.displayName ?? a.user.email}
              </Link>{" "}
              · suspended for: {a.user.statusReason ?? "—"}
              {a.user.suspendedUntil &&
                ` (until ${a.user.suspendedUntil.toISOString().slice(0, 10)})`}
            </p>
            <p className="mt-2 whitespace-pre-wrap rounded bg-mist px-3 py-2 text-sm">
              {a.message}
            </p>
            <form action={appealAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="appealId" value={a.id} />
              <input
                name="note"
                placeholder="Note to the member"
                aria-label="Note to the member"
                className="h-9 min-w-56 flex-1 rounded-md border border-forest/15 bg-cream/80 px-2 text-sm"
              />
              <button name="decision" value="approve" className={btn}>
                Restore account
              </button>
              <button
                name="decision"
                value="reject"
                className={`${btn} text-coral-deep`}
              >
                Keep suspension
              </button>
            </form>
          </li>
        ))}
      </ul>
      {appeals.length === 0 && (
        <p className="mt-6 text-ink/70">No appeals waiting.</p>
      )}
    </div>
  );
}
