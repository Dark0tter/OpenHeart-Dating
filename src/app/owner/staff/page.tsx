import Link from "next/link";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/owner-ui";
import { staffList } from "@/lib/owner-stats";
import { ROLE_LABEL } from "@/lib/staff-roles";
import { changeRole } from "@/app/owner/actions";

export const dynamic = "force-dynamic";

const btn =
  "rounded-md border border-forest/20 px-2.5 py-1 text-xs hover:bg-mist";
const dangerBtn =
  "rounded-md border border-coral/40 px-2.5 py-1 text-xs text-coral-deep hover:bg-coral/10";
const input = "h-8 rounded-md border border-forest/15 bg-cream/80 px-2 text-xs";

const when = (d: Date | null) =>
  d ? d.toLocaleDateString("en-US", { dateStyle: "medium" }) : "never";

async function searchMembers(q: string) {
  const term = q.trim();
  if (term.length < 2) return [];
  return prisma.user.findMany({
    where: {
      accountStatus: { not: "DELETED" },
      OR: [
        { email: term.toLowerCase() },
        { id: term },
        {
          profile: { displayName: { contains: term, mode: "insensitive" } },
        },
      ],
    },
    take: 20,
    orderBy: { lastActiveAt: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      createdAt: true,
      verification: { select: { status: true } },
      profile: { select: { displayName: true, city: true } },
    },
  });
}

function RoleForm({
  userId,
  role,
  label,
  q,
  needsReason,
  danger,
}: {
  userId: string;
  role: UserRole;
  label: string;
  q?: string;
  needsReason?: boolean;
  danger?: boolean;
}) {
  return (
    <form action={changeRole} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />
      {q && <input type="hidden" name="q" value={q} />}
      {needsReason && (
        <input
          name="reason"
          required
          maxLength={300}
          placeholder="Reason (kept in the audit log)"
          aria-label="Reason"
          className={`${input} w-56`}
        />
      )}
      <button className={danger ? dangerBtn : btn}>{label}</button>
    </form>
  );
}

export default async function OwnerStaff({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ok?: string; error?: string }>;
}) {
  const { q = "", ok, error } = await searchParams;
  const [staff, results, history] = await Promise.all([
    staffList(),
    searchMembers(q),
    prisma.modAction.findMany({
      where: { action: { startsWith: "role_" } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        note: true,
        targetUserId: true,
      },
    }),
  ]);
  const historyNames = new Map(
    (
      await prisma.profile.findMany({
        where: {
          userId: {
            in: history.flatMap((h) =>
              h.targetUserId ? [h.targetUserId] : [],
            ),
          },
        },
        select: { userId: true, displayName: true },
      })
    ).map((p) => [p.userId, p.displayName]),
  );

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Staff
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/70">
        Only you can promote or demote. Moderators handle reports, photos,
        appeals and support. Admins can also manage sponsors and supporters,
        file child-safety reports and read the audit log. Changes take effect on
        their next page load, and they get a notification.
      </p>

      {ok && (
        <p
          role="status"
          className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {ok}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-deep"
        >
          {error}
        </p>
      )}

      <SectionTitle>Your team</SectionTitle>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-forest/15 text-ink/70">
            <tr>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Role</th>
              <th className="py-2 pr-4 font-medium">Last on site</th>
              <th className="py-2 pr-4 text-right font-medium">
                Actions (30 d)
              </th>
              <th className="py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest/10">
            {staff.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="py-2 pr-4">
                  <Link href={`/mod/users/${s.id}`} className="hover:underline">
                    {s.profile?.displayName ?? "No profile"}
                  </Link>
                  <span className="block text-xs text-ink/60">{s.email}</span>
                  {s.accountStatus !== "ACTIVE" && (
                    <span className="block text-xs text-coral-deep">
                      {s.accountStatus.toLowerCase()}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{ROLE_LABEL[s.role]}</td>
                <td className="py-2 pr-4 text-ink/70">
                  {when(s.lastActiveAt)}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {s.actions30}
                  <span className="block text-xs text-ink/60">
                    last {when(s.lastActionAt)}
                  </span>
                </td>
                <td className="space-y-1.5 py-2">
                  {s.role === UserRole.OWNER ? (
                    <span className="text-xs text-ink/60">You</span>
                  ) : (
                    <>
                      {s.role === UserRole.MODERATOR && (
                        <RoleForm
                          userId={s.id}
                          role={UserRole.ADMIN}
                          label="Promote to admin"
                        />
                      )}
                      {s.role === UserRole.ADMIN && (
                        <RoleForm
                          userId={s.id}
                          role={UserRole.MODERATOR}
                          label="Demote to moderator"
                          needsReason
                        />
                      )}
                      <RoleForm
                        userId={s.id}
                        role={UserRole.MEMBER}
                        label="Remove from staff"
                        needsReason
                        danger
                      />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>Add staff</SectionTitle>
      <p className="mt-1 text-sm text-ink/70">
        Search by email, display name, or member ID. New staff must have
        verified their age.
      </p>
      <form className="mt-3 flex flex-wrap gap-2 text-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Email, name, or ID"
          aria-label="Find a member"
          className="h-9 w-72 rounded-md border border-forest/15 bg-cream/80 px-3"
        />
        <button className="h-9 rounded-md border border-forest/20 px-3 hover:bg-mist">
          Search
        </button>
      </form>
      {q && (
        <ul className="mt-3 divide-y divide-forest/10 rounded-lg border border-forest/10">
          {results.length === 0 && (
            <li className="px-4 py-3 text-sm text-ink/70">No members found.</li>
          )}
          {results.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span>
                <Link
                  href={`/mod/users/${u.id}`}
                  className="font-medium hover:underline"
                >
                  {u.profile?.displayName ?? "No profile"}
                </Link>{" "}
                <span className="text-ink/60">
                  · {u.email} · {ROLE_LABEL[u.role]}
                  {u.profile?.city ? ` · ${u.profile.city}` : ""} · joined{" "}
                  {when(u.createdAt)}
                </span>
                {u.verification?.status !== "VERIFIED_ADULT" && (
                  <span className="block text-xs text-coral-deep">
                    Not age-verified yet
                  </span>
                )}
                {u.accountStatus !== "ACTIVE" && (
                  <span className="block text-xs text-coral-deep">
                    Account {u.accountStatus.toLowerCase()}
                  </span>
                )}
              </span>
              {u.role === UserRole.MEMBER && (
                <span className="flex gap-2">
                  <RoleForm
                    userId={u.id}
                    role={UserRole.MODERATOR}
                    label="Make moderator"
                    q={q}
                  />
                  <RoleForm
                    userId={u.id}
                    role={UserRole.ADMIN}
                    label="Make admin"
                    q={q}
                  />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>Recent role changes</SectionTitle>
      <ul className="mt-3 space-y-1 text-sm">
        {history.length === 0 && <li className="text-ink/70">None yet.</li>}
        {history.map((h) => (
          <li key={h.id}>
            <span className="text-ink/60">{when(h.createdAt)} · </span>
            {h.targetUserId ? (
              <Link
                href={`/mod/users/${h.targetUserId}`}
                className="hover:underline"
              >
                {historyNames.get(h.targetUserId) ?? "Member"}
              </Link>
            ) : (
              "Member"
            )}
            {": "}
            {h.note}
          </li>
        ))}
      </ul>
    </div>
  );
}
