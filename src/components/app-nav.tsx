"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/feed", label: "Feed" },
  { href: "/rooms", label: "Rooms" },
  { href: "/search", label: "Search" },
  { href: "/messages", label: "Messages" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 border-b border-forest/10 bg-bloom/90 backdrop-blur-md">
      <div className="oh-flag-stripe" aria-hidden />
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link
          href="/feed"
          className="font-[family-name:var(--font-fraunces)] text-xl text-forest"
        >
          OpenHeart
        </Link>
        <div className="flex gap-1 overflow-x-auto text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-2 whitespace-nowrap transition-colors",
                pathname.startsWith(l.href)
                  ? "bg-forest text-cream"
                  : "text-forest/70 hover:bg-mist hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
