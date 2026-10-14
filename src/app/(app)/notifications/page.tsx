"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRealtime } from "@/components/realtime";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

function when(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Item[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) setItems((await res.json()).notifications);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime((e) => {
    if (e.type === "notification") load();
  });

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  async function open(item: Item) {
    if (!item.readAt) {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id] }),
      });
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          Notifications
        </h1>
        {items?.some((i) => !i.readAt) && (
          <Button type="button" variant="ghost" onClick={markAll}>
            Mark all read
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink/60">
        Choose how you&apos;re notified in{" "}
        <Link href="/settings#notifications" className="underline">
          Settings
        </Link>
        .
      </p>

      {items === null ? (
        <p className="mt-6 text-ink/60">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-ink/60">
          Nothing yet. Matches and messages will show up here.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-forest/10 rounded-lg border border-forest/10 bg-cream/60">
          {items.map((i) => {
            const content = (
              <div className="flex gap-3 px-4 py-3">
                <span
                  aria-hidden
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${i.readAt ? "bg-transparent" : "bg-coral"}`}
                />
                <div className="min-w-0">
                  <p
                    className={`text-sm ${i.readAt ? "text-ink/70" : "font-medium text-ink"}`}
                  >
                    {i.title}
                    {!i.readAt && <span className="sr-only"> (unread)</span>}
                  </p>
                  {i.body && <p className="text-sm text-ink/60">{i.body}</p>}
                  <p className="text-xs text-ink/45">{when(i.createdAt)}</p>
                </div>
              </div>
            );
            return (
              <li key={i.id}>
                {i.link ? (
                  <Link
                    href={i.link}
                    onClick={() => open(i)}
                    className="block hover:bg-mist/60"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => open(i).then(load)}
                    className="block w-full text-left hover:bg-mist/60"
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
