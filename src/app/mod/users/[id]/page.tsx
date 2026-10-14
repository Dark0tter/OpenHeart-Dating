import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { memberAction } from "@/app/mod/actions";
import { supporterAction } from "@/app/mod/supporter-actions";
import { supporterStatus } from "@/lib/supporter";

export const dynamic = "force-dynamic";

const btn =
  "rounded-md border border-forest/20 px-3 py-1.5 text-sm hover:bg-mist";

export default async function MemberDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = (await requireStaff())!;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      role: true,
      accountStatus: true,
      statusReason: true,
      suspendedUntil: true,
      photoVerifiedAt: true,
      createdAt: true,
      lastActiveAt: true,
      verification: { select: { status: true } },
      profile: {
        select: { displayName: true, isActive: true, visibility: true },
      },
    },
  });
  if (!user) notFound();

  const [reports, actions, supporter] = await Promise.all([
    prisma.report.findMany({
      where: { reportedUserId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.modAction.findMany({
      where: { targetUserId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    supporterStatus(id),
  ]);
  const isAdmin = staff.role === UserRole.ADMIN;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          {user.profile?.displayName ?? "(no profile)"}
        </h1>
        <dl className="mt-3 grid max-w-xl grid-cols-[10rem_1fr] gap-y-1 text-sm">
          <dt className="text-ink/70">Email</dt>
          <dd>
            {user.email}{" "}
            {user.emailVerified ? "(confirmed)" : "(not confirmed)"}
          </dd>
          <dt className="text-ink/70">Account</dt>
          <dd>
            {user.accountStatus.toLowerCase()}
            {user.statusReason && ` — ${user.statusReason}`}
            {user.suspendedUntil &&
              ` (until ${user.suspendedUntil.toISOString().slice(0, 10)})`}
          </dd>
          <dt className="text-ink/70">Role</dt>
          <dd>{user.role.toLowerCase()}</dd>
          <dt className="text-ink/70">Age check</dt>
          <dd>
            {user.verification?.status.toLowerCase().replaceAll("_", " ") ??
              "not started"}
          </dd>
          <dt className="text-ink/70">Photo badge</dt>
          <dd>
            {user.photoVerifiedAt
              ? user.photoVerifiedAt.toISOString().slice(0, 10)
              : "no"}
          </dd>
          <dt className="text-ink/70">Profile</dt>
          <dd>
            {user.profile
              ? `${user.profile.isActive ? "on" : "off"}, ${user.profile.visibility.toLowerCase()}`
              : "none"}
          </dd>
          <dt className="text-ink/70">Joined / active</dt>
          <dd>
            {user.createdAt.toISOString().slice(0, 10)} /{" "}
            {user.lastActiveAt.toISOString().slice(0, 10)}
          </dd>
        </dl>
      </div>

      <section className="rounded-lg border border-forest/10 p-4">
        <h2 className="font-medium text-forest">Actions</h2>
        <form action={memberAction} className="mt-3 space-y-3">
          <input type="hidden" name="userId" value={user.id} />
          <textarea
            name="note"
            rows={2}
            placeholder="Reason / message to the member"
            aria-label="Reason or message"
            className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              name="days"
              aria-label="Suspension length"
              className="h-9 rounded-md border border-forest/15 bg-cream/80 px-2 text-sm"
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="">Until reviewed (ban)</option>
            </select>
            {user.accountStatus === "SUSPENDED" ? (
              <button name="action" value="reinstate" className={btn}>
                Reinstate
              </button>
            ) : (
              <button
                name="action"
                value="suspend"
                className={`${btn} text-coral-deep`}
              >
                Suspend
              </button>
            )}
            <button name="action" value="warn" className={btn}>
              Warn
            </button>
            {user.photoVerifiedAt && (
              <button name="action" value="revoke_photo_badge" className={btn}>
                Remove photo badge
              </button>
            )}
          </div>
          {isAdmin && user.id !== staff.id && (
            <div className="flex items-center gap-2">
              <select
                name="role"
                defaultValue={user.role}
                aria-label="Role"
                className="h-9 rounded-md border border-forest/15 bg-cream/80 px-2 text-sm"
              >
                <option value="MEMBER">Member</option>
                <option value="MODERATOR">Moderator</option>
                <option value="ADMIN">Admin</option>
              </select>
              <button name="action" value="set_role" className={btn}>
                Change role
              </button>
            </div>
          )}
        </form>
      </section>

      {isAdmin && (
        <section className="rounded-lg border border-forest/10 p-4">
          <h2 className="font-medium text-forest">Supporter</h2>
          <p className="mt-1 text-sm text-ink/70">
            {supporter.active
              ? `Active${supporter.until ? ` until ${supporter.until.toISOString().slice(0, 10)}` : ""} (${supporter.provider ?? "manual"}).`
              : "Not a supporter."}
            {supporter.note && ` Note: ${supporter.note}`}
          </p>
          <form
            action={supporterAction}
            className="mt-3 flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="userId" value={user.id} />
            <select
              name="months"
              aria-label="How long"
              className="h-9 rounded-md border border-forest/15 bg-cream/80 px-2 text-sm"
            >
              <option value="1">1 month</option>
              <option value="3">3 months</option>
              <option value="12">12 months</option>
            </select>
            <input
              name="note"
              placeholder="Why / receipt reference"
              aria-label="Note"
              className="h-9 min-w-48 flex-1 rounded-md border border-forest/15 bg-cream/80 px-2 text-sm"
            />
            <button name="action" value="grant" className={btn}>
              {supporter.active ? "Add time" : "Make supporter"}
            </button>
            {supporter.active && (
              <button name="action" value="end" className={btn}>
                End now
              </button>
            )}
          </form>
        </section>
      )}

      <section>
        <h2 className="font-medium text-forest">Reports about this member</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/mod/reports/${r.id}`}
                className="text-forest underline"
              >
                {r.reason.replaceAll("_", " ").toLowerCase()}
              </Link>{" "}
              · {r.status} · {r.createdAt.toISOString().slice(0, 10)}
            </li>
          ))}
          {reports.length === 0 && <li className="text-ink/70">None.</li>}
        </ul>
      </section>

      <section>
        <h2 className="font-medium text-forest">Staff actions</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {actions.map((a) => (
            <li key={a.id}>
              <span className="text-ink/70">
                {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>{" "}
              {a.action.replaceAll("_", " ")}
              {a.note && <span className="text-ink/70"> — {a.note}</span>}
            </li>
          ))}
          {actions.length === 0 && <li className="text-ink/70">None.</li>}
        </ul>
      </section>
    </div>
  );
}
