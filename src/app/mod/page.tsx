import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ModOverview() {
  const [
    highReports,
    openReports,
    photos,
    selfies,
    appeals,
    tickets,
    escalated,
  ] = await Promise.all([
    prisma.report.count({ where: { status: "open", priority: "HIGH" } }),
    prisma.report.count({ where: { status: "open" } }),
    prisma.photo.count({ where: { status: "PENDING" } }),
    prisma.selfieVerification.count({ where: { status: "PENDING" } }),
    prisma.appeal.count({ where: { status: "PENDING" } }),
    prisma.supportTicket.count({ where: { status: "open" } }),
    prisma.report.count({
      where: { escalatedAt: { not: null }, externalRef: null },
    }),
  ]);

  const cards = [
    {
      href: "/mod/reports?priority=HIGH",
      label: "Urgent reports",
      value: highReports,
      urgent: highReports > 0,
    },
    { href: "/mod/reports", label: "Open reports", value: openReports },
    { href: "/mod/photos", label: "Photos to review", value: photos },
    { href: "/mod/selfies", label: "Selfies to review", value: selfies },
    { href: "/mod/appeals", label: "Appeals", value: appeals },
    { href: "/mod/support", label: "Support tickets", value: tickets },
    {
      href: "/mod/reports?escalated=1",
      label: "Child-safety cases not yet filed",
      value: escalated,
      urgent: escalated > 0,
    },
  ];

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Overview
      </h1>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className={`block rounded-lg border p-4 hover:shadow-sm ${
                c.urgent
                  ? "border-coral bg-coral/10"
                  : "border-forest/10 bg-cream/70"
              }`}
            >
              <span className="block text-3xl font-semibold text-forest">
                {c.value}
              </span>
              <span className="text-sm text-ink/70">{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="mt-10 max-w-2xl space-y-2 text-sm text-ink/70">
        <h2 className="font-medium text-forest">Ground rules</h2>
        <p>
          Every action you take here is recorded in the audit log. Look at the
          evidence before acting, write a short reason, and never contact a
          member outside these tools.
        </p>
        <p>
          Child-safety reports: don&apos;t download or share suspected abuse
          images. Use &ldquo;Escalate&rdquo; — it suspends the account,
          preserves the evidence and places a legal hold — then an admin files
          the CyberTipline report at report.cybertip.org and records the number.
        </p>
      </section>
    </div>
  );
}
