import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/session";

export const metadata = { title: "Owner · Kindred Kinks" };

const LINKS = [
  { href: "/owner", label: "Overview" },
  { href: "/owner/cities", label: "Cities" },
  { href: "/owner/ads", label: "Ads" },
  { href: "/owner/staff", label: "Staff" },
  { href: "/owner/announcements", label: "Announcements" },
];

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await requireStaff("OWNER"))) notFound();

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-forest/10 bg-cream/90">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <Link
            href="/owner"
            className="font-[family-name:var(--font-fraunces)] text-xl text-forest"
          >
            Kindred Kinks owner
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
            <Link href="/mod" className="text-forest hover:underline">
              Moderation tools
            </Link>
          </nav>
          <Link
            href="/feed"
            className="ml-auto text-sm text-ink/70 hover:underline"
          >
            Back to site
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
