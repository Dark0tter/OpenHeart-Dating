import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUSES = ["open", "resolved", "dismissed"] as const;

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    escalated?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as never) ? sp.status! : "open";
  const where: Prisma.ReportWhereInput = sp.escalated
    ? { escalatedAt: { not: null } }
    : { status, ...(sp.priority === "HIGH" ? { priority: "HIGH" } : {}) };

  const reports = await prisma.report.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 100,
    include: {
      reportedUser: {
        select: { email: true, profile: { select: { displayName: true } } },
      },
    },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Reports
      </h1>
      <nav className="mt-4 flex gap-4 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/mod/reports?status=${s}`}
            className={
              s === status && !sp.escalated
                ? "font-semibold text-forest"
                : "text-forest/70"
            }
          >
            {s[0].toUpperCase() + s.slice(1)}
          </Link>
        ))}
        <Link
          href="/mod/reports?escalated=1"
          className={
            sp.escalated ? "font-semibold text-forest" : "text-forest/70"
          }
        >
          Child-safety cases
        </Link>
      </nav>
      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-ink/60">
          <tr>
            <th className="py-2">Priority</th>
            <th>Reason</th>
            <th>Member</th>
            <th>Source</th>
            <th>Filed</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} className="border-t border-forest/10">
              <td className="py-2">
                <span
                  className={
                    r.priority === "HIGH" ? "font-semibold text-coral-deep" : ""
                  }
                >
                  {r.priority}
                </span>
                {r.legalHold && (
                  <span className="ml-2 text-xs text-coral-deep">HOLD</span>
                )}
              </td>
              <td>
                <Link
                  href={`/mod/reports/${r.id}`}
                  className="text-forest underline"
                >
                  {r.reason.replaceAll("_", " ").toLowerCase()}
                </Link>
              </td>
              <td>
                {r.reportedUser.profile?.displayName ?? r.reportedUser.email}
              </td>
              <td>{r.source.toLowerCase()}</td>
              <td>
                {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reports.length === 0 && (
        <p className="mt-6 text-ink/60">Nothing here.</p>
      )}
    </div>
  );
}
