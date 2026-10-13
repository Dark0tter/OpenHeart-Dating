import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { SponsorSlot } from "@/components/sponsor-slot";
import { requireUser } from "@/lib/session";
import { flagById, flagStyle, THEME_MODES, type ThemeMode } from "@/lib/themes";

const FOOTER_LINKS = [
  { href: "/guidelines", label: "Guidelines" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/child-safety", label: "Child safety" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const mode: ThemeMode = THEME_MODES.includes(user?.themeMode as ThemeMode)
    ? (user!.themeMode as ThemeMode)
    : "system";
  const flag = flagById(user?.themeFlag);

  return (
    <div
      className="oh-atmosphere min-h-screen"
      data-mode={mode}
      data-flag={flag ? "on" : "none"}
      style={flagStyle(flag)}
    >
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">
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
