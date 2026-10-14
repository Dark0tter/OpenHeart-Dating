"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "oh-getting-started-dismissed";

type Item = { key: string; label: string; href: string; done: boolean };

/** First-run checklist on the home feed. Hides itself once everything is done. */
export function GettingStarted() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    setWelcome(new URLSearchParams(window.location.search).has("welcome"));
    (async () => {
      const [profileRes, roomsRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/rooms"),
      ]);
      if (!profileRes.ok) return;
      const d = await profileRes.json();
      const steps: { key: string; done: boolean }[] =
        d.completeness?.steps ?? [];
      const stepDone = (key: string) =>
        steps.find((s) => s.key === key)?.done ?? false;
      const rooms: { joined: boolean }[] = roomsRes.ok
        ? ((await roomsRes.json()).rooms ?? [])
        : [];
      const pushSupported =
        typeof window !== "undefined" && "Notification" in window;

      const list: Item[] = [
        {
          key: "profile",
          label: "Tell people about yourself",
          href: "/onboarding?step=about",
          done: Boolean(d.profile?.bio) && (d.completeness?.percent ?? 0) >= 60,
        },
        {
          key: "photo",
          label: "Add a photo",
          href: "/onboarding?step=photos",
          done: stepDone("photo"),
        },
        {
          key: "email",
          label: "Confirm your email",
          href: "/settings",
          done: Boolean(d.emailVerified),
        },
        {
          key: "live",
          label: "Verify your age and go live",
          href: "/onboarding?step=golive",
          done: Boolean(d.profile?.isActive),
        },
        {
          key: "room",
          label: "Join a room for something you're into",
          href: "/rooms",
          done: rooms.some((r) => r.joined),
        },
        {
          key: "search",
          label: "Find people near you",
          href: "/search",
          done: false,
        },
      ];
      if (pushSupported) {
        list.push({
          key: "notify",
          label: "Turn on notifications so you don't miss a match",
          href: "/settings#notifications",
          done: Notification.permission === "granted",
        });
      }
      setItems(list);
    })().catch(() => {});
  }, []);

  if (!items) return null;
  const required = items.filter((i) => i.key !== "search");
  const doneCount = items.filter((i) => i.done).length;
  if (required.every((i) => i.done) || (dismissed && !welcome)) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
    setItems(null);
  }

  return (
    <section
      aria-labelledby="getting-started"
      className="mb-8 rounded-lg border border-forest/15 bg-mist/60 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="getting-started"
            className="font-[family-name:var(--font-fraunces)] text-xl text-forest"
          >
            {welcome ? "You're in! Here's what to do next" : "Getting started"}
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            {doneCount} of {items.length} done
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide getting started checklist"
          className="rounded-full p-1.5 text-ink/70 hover:bg-cream hover:text-forest"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((i) => (
          <li key={i.key}>
            <Link
              href={i.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-cream/70",
                i.done ? "text-ink/70" : "text-forest",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  i.done
                    ? "border-forest bg-forest text-cream"
                    : "border-forest/30 text-transparent",
                )}
              >
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className={cn(i.done && "line-through")}>{i.label}</span>
              <span className="sr-only">{i.done ? "(done)" : "(to do)"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
