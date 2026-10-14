"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Blocked = { userId: string; displayName: string; blockedAt: string };

export function BlockedList() {
  const [list, setList] = useState<Blocked[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/blocks")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setList(d?.blocked ?? []))
      .catch(() => setList([]));
  }, []);

  async function unblock(b: Blocked) {
    if (
      !confirm(
        `Unblock ${b.displayName}? You'll be able to see each other again, but old likes and chats won't come back.`,
      )
    ) {
      return;
    }
    const res = await fetch("/api/blocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: b.userId }),
    });
    if (res.ok) {
      setList((l) => l?.filter((x) => x.userId !== b.userId) ?? null);
      setMsg(`${b.displayName} is unblocked.`);
    } else {
      setMsg("Couldn't unblock. Please try again.");
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="font-medium text-forest">Blocked people</h2>
      <p className="text-sm text-ink/70">
        To block someone, use the Block button on their profile or in a room.
      </p>
      {list === null ? (
        <p className="text-sm text-ink/70">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-ink/70">You haven&apos;t blocked anyone.</p>
      ) : (
        <ul className="divide-y divide-forest/10 rounded-lg border border-forest/10">
          {list.map((b) => (
            <li
              key={b.userId}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <span>
                {b.displayName}
                <span className="block text-xs text-ink/60">
                  Blocked {new Date(b.blockedAt).toLocaleDateString()}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => unblock(b)}
              >
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p role="status" className="text-sm text-forest">
          {msg}
        </p>
      )}
    </section>
  );
}
