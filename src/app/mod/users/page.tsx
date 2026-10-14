import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MemberLookup({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = (await searchParams).q?.trim() ?? "";
  const users = q
    ? await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { id: q },
            { profile: { displayName: { contains: q, mode: "insensitive" } } },
          ],
        },
        take: 30,
        select: {
          id: true,
          email: true,
          accountStatus: true,
          role: true,
          profile: { select: { displayName: true } },
        },
      })
    : [];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Members
      </h1>
      <form className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Email, display name or member ID"
          aria-label="Search members"
          className="h-10 w-full max-w-md rounded-md border border-forest/15 bg-cream/80 px-3 text-sm"
        />
        <button className="rounded-md border border-forest/20 px-3 text-sm hover:bg-mist">
          Search
        </button>
      </form>
      <ul className="mt-6 space-y-2 text-sm">
        {users.map((u) => (
          <li key={u.id}>
            <Link href={`/mod/users/${u.id}`} className="text-forest underline">
              {u.profile?.displayName ?? "(no profile)"}
            </Link>{" "}
            · {u.email} · {u.accountStatus.toLowerCase()}
            {u.role !== "MEMBER" && ` · ${u.role.toLowerCase()}`}
          </li>
        ))}
      </ul>
      {q && users.length === 0 && (
        <p className="mt-6 text-ink/60">No one found.</p>
      )}
    </div>
  );
}
