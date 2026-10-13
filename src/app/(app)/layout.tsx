import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { SponsorSlot } from "@/components/sponsor-slot";

const FOOTER_LINKS = [
  { href: "/guidelines", label: "Guidelines" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/child-safety", label: "Child safety" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="oh-atmosphere min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="px-4 pb-10">
        <SponsorSlot />
        <nav className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-ink/50">
          {FOOTER_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
