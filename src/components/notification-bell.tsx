"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useRealtime } from "@/components/realtime";

export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/notifications?count=1");
    if (res.ok) setUnread((await res.json()).unread);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtime(
    (e) => {
      if (e.type === "notification") refresh();
    },
    { onPoll: refresh, pollMs: 30_000 },
  );

  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative rounded-md p-2 text-forest hover:bg-mist"
    >
      <Bell aria-hidden className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-coral px-1 text-center text-[10px] font-semibold leading-5 text-cream">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
