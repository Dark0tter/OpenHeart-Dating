import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { SponsorSlot } from "@/components/sponsor-slot";
import { SponsorGate } from "@/components/sponsor-gate";
import { EmailBanner } from "@/components/email-banner";
import { RealtimeProvider } from "@/components/realtime";
import { NativePushBridge } from "@/components/native-push-bridge";
import { CallProvider } from "@/components/call-provider";
import { MemberGate } from "@/components/member-gate";
import { AnnouncementBar } from "@/components/announcement-bar";
import { currentAnnouncements } from "@/lib/announcements";
import { isAppRequest } from "@/lib/content-policy";
import { OPERATOR } from "@/lib/constants/site";
import { redirect } from "next/navigation";
import { AccountStatus } from "@prisma/client";
import { currentAccount, isStaff } from "@/lib/session";
import { flagById, flagStyle, THEME_MODES, type ThemeMode } from "@/lib/themes";

const FOOTER_LINKS = [
  { href: "/safety", label: "Safety tips" },
  { href: "/support", label: "Support" },
  { href: "/guidelines", label: "Guidelines" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/child-safety", label: "Child safety" },
  { href: "/advertise", label: "Advertise with us" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = await currentAccount();
  if (account?.accountStatus === AccountStatus.SUSPENDED)
    redirect("/suspended");
  const user = account;
  const mode: ThemeMode = THEME_MODES.includes(user?.themeMode as ThemeMode)
    ? (user!.themeMode as ThemeMode)
    : "system";
  const flag = flagById(user?.themeFlag);
  const announcements = user
    ? await currentAnnouncements({ app: await isAppRequest() }).catch(() => [])
    : [];

  return (
    <div
      className="oh-atmosphere min-h-screen"
      data-mode={mode}
      data-flag={flag ? "on" : "none"}
      style={flagStyle(flag)}
    >
      <RealtimeProvider>
        <CallProvider>
          <AppNav />
          <NativePushBridge />
          {user && !user.emailVerified && <EmailBanner email={user.email} />}
          {user && announcements.length > 0 && (
            <AnnouncementBar items={announcements} />
          )}
          {user && isStaff(user.role) && (
            <div className="bg-forest px-4 py-1.5 text-center text-xs text-cream">
              <Link href="/mod" className="underline">
                Moderation dashboard
              </Link>
              {user.role === "OWNER" && (
                <>
                  {" · "}
                  <Link href="/owner" className="underline">
                    Owner dashboard
                  </Link>
                </>
              )}
            </div>
          )}
          <main id="main" className="mx-auto max-w-5xl px-4 py-8">
            <MemberGate
              isMember={Boolean(
                user?.profile?.isActive &&
                user.verification?.status === "VERIFIED_ADULT",
              )}
            >
              {children}
            </MemberGate>
          </main>
          <footer className="px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">
            <SponsorGate>
              <SponsorSlot />
            </SponsorGate>
            <nav
              aria-label="Site information"
              className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-ink/70"
            >
              {FOOTER_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="hover:underline">
                  {l.label}
                </Link>
              ))}
            </nav>
            <p className="mt-3 text-center text-xs text-ink/50">
              © {new Date().getFullYear()} {OPERATOR}
            </p>
          </footer>
        </CallProvider>
      </RealtimeProvider>
    </div>
  );
}
