import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Moderation · OpenHeart" };

const LINKS = [
  { href: "/mod", label: "Overview" },
  { href: "/mod/reports", label: "Reports" },
  { href: "/mod/photos", label: "Photos" },
  { href: "/mod/selfies", label: "Selfies" },
  { href: "/mod/appeals", label: "Appeals" },
  { href: "/mod/support", label: "Support" },
  { href: "/mod/rooms", label: "Rooms" },
  { href: "/mod/events", label: "Events" },
  { href: "/mod/users", label: "Members" },
];

export default async function ModLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await requireStaff();
  if (!staff) notFound();

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-forest/10 bg-cream/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link
            href="/mod"
            className="font-[family-name:var(--font-fraunces)] text-xl text-forest"
          >
            OpenHeart moderation
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-forest hover:underline"
              >
                {l.label}
              </Link>
            ))}
            {staff.role === UserRole.ADMIN && (
              <Link href="/mod/audit" className="text-forest hover:underline">
                Audit log
              </Link>
            )}
          </nav>
          <Link
            href="/feed"
            className="ml-auto text-sm text-ink/60 hover:underline"
          >
            Back to site
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
