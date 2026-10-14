"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/rooms", label: "Rooms", icon: MessagesSquare },
  { href: "/events", label: "Events & munches", icon: CalendarDays },
];

/** Rooms and events share the Community tab in the main navigation. */
export function CommunityTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Community" className="mb-6 flex gap-2">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-forest text-cream"
                : "bg-mist text-forest hover:bg-sage/30",
            )}
          >
            <Icon aria-hidden className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
