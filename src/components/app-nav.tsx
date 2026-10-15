"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { usePathname } from "next/navigation";
import {
  House,
  MessageCircle,
  MessagesSquare,
  Search,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";

const links: {
  href: string;
  label: string;
  icon: LucideIcon;
  also?: string[];
}[] = [
  { href: "/feed", label: "Home", icon: House },
  { href: "/search", label: "Search", icon: Search },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  {
    href: "/rooms",
    label: "Community",
    icon: MessagesSquare,
    also: ["/events"],
  },
  {
    href: "/profile",
    label: "Profile",
    icon: UserRound,
    also: ["/onboarding"],
  },
];

export function AppNav() {
  const pathname = usePathname();
  const isActive = (href: string) => {
    const l = links.find((x) => x.href === href);
    return [href, ...(l?.also ?? [])].some((p) => pathname.startsWith(p));
  };

  return (
    <>
      <nav className="sticky top-0 z-30 border-b border-forest/10 bg-bloom/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="oh-flag-stripe" aria-hidden />
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 font-[family-name:var(--font-fraunces)] text-xl text-forest"
          >
            <BrandMark className="h-7 w-7" />
            Kindred Kinks
          </Link>
          <div className="flex items-center gap-1">
            <div className="hidden gap-1 text-sm md:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "rounded-md px-3 py-2 whitespace-nowrap transition-colors",
                    isActive(l.href)
                      ? "bg-forest text-cream"
                      : "text-forest/80 hover:bg-mist hover:text-ink",
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <NotificationBell />
            <Link
              href="/settings"
              aria-label="Settings"
              aria-current={isActive("/settings") ? "page" : undefined}
              className={cn(
                "rounded-md p-2 hover:bg-mist",
                isActive("/settings") ? "text-coral" : "text-forest",
              )}
            >
              <Settings aria-hidden className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Phones and the mobile apps: fixed tab bar, no sideways scrolling. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-forest/10 bg-bloom/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="grid grid-cols-5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                    active ? "text-coral" : "text-forest/80 hover:text-ink",
                  )}
                >
                  <Icon
                    aria-hidden
                    className="h-5 w-5"
                    strokeWidth={active ? 2.4 : 1.8}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
