import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AuditLog({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  if (!(await requireStaff("ADMIN"))) notFound();
  const before = (await searchParams).before;
  const rows = await prisma.modAction.findMany({
    where: before ? { createdAt: { lt: new Date(before) } } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const actorIds = [
    ...new Set(rows.map((r) => r.actorId).filter(Boolean)),
  ] as string[];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true },
  });
  const actorName = (id: string | null) =>
    id ? (actors.find((a) => a.id === id)?.email ?? id.slice(0, 8)) : "system";

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Audit log
      </h1>
      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-ink/60">
          <tr>
            <th className="py-2">When (UTC)</th>
            <th>Who</th>
            <th>Action</th>
            <th>Member</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-forest/10 align-top">
              <td className="py-2 whitespace-nowrap">
                {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </td>
              <td>{actorName(r.actorId)}</td>
              <td>{r.action.replaceAll("_", " ")}</td>
              <td>
                {r.targetUserId && (
                  <Link
                    href={`/mod/users/${r.targetUserId}`}
                    className="text-forest underline"
                  >
                    {r.targetUserId.slice(0, 8)}
                  </Link>
                )}
              </td>
              <td className="max-w-md break-words text-ink/70">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 100 && (
        <Link
          href={`/mod/audit?before=${rows[rows.length - 1].createdAt.toISOString()}`}
          className="mt-4 inline-block text-forest underline"
        >
          Older →
        </Link>
      )}
    </div>
  );
}
