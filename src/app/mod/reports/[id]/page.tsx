import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin as isAdminRole, requireStaff } from "@/lib/session";
import { orderedPair } from "@/lib/utils";
import { reportAction } from "@/app/mod/actions";

export const dynamic = "force-dynamic";

function pretty(details: string | null) {
  if (!details) return null;
  try {
    return JSON.stringify(JSON.parse(details), null, 2);
  } catch {
    return details;
  }
}

const btn =
  "rounded-md px-3 py-2 text-sm font-medium border border-forest/20 hover:bg-mist";

export default async function ReportDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = (await requireStaff())!;
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      reporter: {
        select: {
          id: true,
          email: true,
          profile: { select: { displayName: true } },
        },
      },
      reportedUser: {
        select: {
          id: true,
          email: true,
          accountStatus: true,
          createdAt: true,
          profile: { select: { displayName: true, bio: true } },
        },
      },
    },
  });
  if (!report) notFound();

  const userId = report.reportedUserId;
  const [priorReports, history, conversation] = await Promise.all([
    prisma.report.count({ where: { reportedUserId: userId, id: { not: id } } }),
    prisma.modAction.findMany({
      where: { OR: [{ reportId: id }, { targetUserId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    report.reporterId
      ? (async () => {
          const [a, b] = orderedPair(report.reporterId!, userId);
          const match = await prisma.match.findUnique({
            where: { userAId_userBId: { userAId: a, userBId: b } },
            select: { id: true },
          });
          if (!match) return [];
          return prisma.message.findMany({
            where: { matchId: match.id },
            orderBy: { createdAt: "desc" },
            take: 50,
          });
        })()
      : Promise.resolve([]),
  ]);
  const isAdmin = isAdminRole(staff.role);
  const open = report.status === "open";

  return (
    <div className="space-y-8">
      <div>
        <Link href="/mod/reports" className="text-sm text-forest underline">
          ← Reports
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          {report.reason.replaceAll("_", " ").toLowerCase()}{" "}
          <span className="text-base text-ink/70">
            ({report.priority.toLowerCase()} priority, {report.status})
          </span>
        </h1>
        <p className="mt-1 text-sm text-ink/70">
          Filed {report.createdAt.toUTCString()} by{" "}
          {report.reporter
            ? (report.reporter.profile?.displayName ?? report.reporter.email)
            : "automated detection"}
          {report.assigneeId &&
            ` · assigned${report.assigneeId === staff.id ? " to you" : ""}`}
        </p>
        {report.legalHold && (
          <p className="mt-2 rounded bg-coral/10 px-3 py-2 text-sm text-coral-deep">
            Legal hold: evidence and this account are preserved even if deleted.
            {report.escalatedAt &&
              ` Escalated ${report.escalatedAt.toUTCString()}.`}
            {report.externalRef
              ? ` CyberTipline report: ${report.externalRef}.`
              : report.escalatedAt
                ? " CyberTipline report not recorded yet."
                : ""}
          </p>
        )}
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-forest/10 p-4">
          <h2 className="font-medium text-forest">Reported member</h2>
          <p className="mt-2 text-sm">
            <Link
              href={`/mod/users/${userId}`}
              className="text-forest underline"
            >
              {report.reportedUser.profile?.displayName ?? "(no profile)"}
            </Link>{" "}
            · {report.reportedUser.email}
          </p>
          <p className="text-sm text-ink/70">
            Status {report.reportedUser.accountStatus.toLowerCase()} · joined{" "}
            {report.reportedUser.createdAt.toISOString().slice(0, 10)} ·{" "}
            {priorReports} other report{priorReports === 1 ? "" : "s"}
          </p>
          {report.reportedUser.profile?.bio && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink/75">
              {report.reportedUser.profile.bio}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-forest/10 p-4">
          <h2 className="font-medium text-forest">Details</h2>
          <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-ink/80">
            {pretty(report.details) ?? "None given."}
          </pre>
          {report.evidenceKey && isAdmin && (
            <p className="mt-2 text-sm">
              Evidence preserved at <code>{report.evidenceKey}</code>{" "}
              <a
                href={`/api/mod/files?key=${encodeURIComponent(report.evidenceKey)}`}
                className="text-forest underline"
              >
                (download, logged)
              </a>
            </p>
          )}
          {report.resolution && (
            <p className="mt-2 text-sm text-forest">
              Resolution: {report.resolution}
            </p>
          )}
        </div>
      </section>

      {conversation.length > 0 && (
        <section>
          <h2 className="font-medium text-forest">
            Conversation between reporter and member (latest 50)
          </h2>
          <ol className="mt-2 max-h-96 space-y-2 overflow-y-auto rounded-lg border border-forest/10 p-4 text-sm">
            {conversation.reverse().map((m) => (
              <li key={m.id}>
                <span className="font-medium">
                  {m.senderId === userId ? "Reported member" : "Reporter"}:
                </span>{" "}
                {m.body ?? "(media)"}
                {m.safetyFlag && (
                  <span className="ml-2 text-xs text-coral-deep">
                    [{m.safetyFlag}]
                  </span>
                )}
                <span className="ml-2 text-xs text-ink/70">
                  {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rounded-lg border border-forest/10 p-4">
        <h2 className="font-medium text-forest">Take action</h2>
        <form action={reportAction} className="mt-3 space-y-3">
          <input type="hidden" name="reportId" value={report.id} />
          <label className="block text-sm">
            <span className="text-ink/70">
              Reason / message (sent to the member for warnings and suspensions;
              CyberTipline number for that action)
            </span>
            <textarea
              name="note"
              rows={3}
              className="mt-1 w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink/70">Suspension length</span>
            <select
              name="days"
              className="mt-1 h-10 rounded-md border border-forest/15 bg-cream/80 px-3"
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="">Until reviewed</option>
              <option value="ban">Permanent ban (can&apos;t rejoin)</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {open && (
              <>
                <button name="action" value="assign" className={btn}>
                  Assign to me
                </button>
                <button name="action" value="dismiss" className={btn}>
                  Dismiss
                </button>
                <button name="action" value="resolve" className={btn}>
                  Resolve
                </button>
                <button name="action" value="warn" className={btn}>
                  Warn member
                </button>
                <button
                  name="action"
                  value="suspend"
                  className={`${btn} text-coral-deep`}
                >
                  Suspend
                </button>
              </>
            )}
            {!report.escalatedAt && (
              <button
                name="action"
                value="escalate"
                className={`${btn} border-coral text-coral-deep`}
              >
                Escalate child-safety case
              </button>
            )}
            {isAdmin && report.escalatedAt && (
              <button name="action" value="external_ref" className={btn}>
                Record CyberTipline number
              </button>
            )}
            {isAdmin && (
              <button
                name="action"
                value={report.legalHold ? "hold_off" : "hold_on"}
                className={btn}
              >
                {report.legalHold ? "Release legal hold" : "Place legal hold"}
              </button>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 className="font-medium text-forest">History</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {history.map((h) => (
            <li key={h.id}>
              <span className="text-ink/70">
                {h.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </span>{" "}
              {h.action.replaceAll("_", " ")}
              {h.note && <span className="text-ink/70"> — {h.note}</span>}
            </li>
          ))}
          {history.length === 0 && (
            <li className="text-ink/70">No actions yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
