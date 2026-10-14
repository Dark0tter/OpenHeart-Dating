"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

type Status = {
  active: boolean;
  until: string | null;
  showBadge: boolean;
  perks: string[];
};

export function SupporterPanel() {
  const [s, setS] = useState<Status | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/supporter")
      .then((r) => r.json())
      .then(setS)
      .catch(() => {});
  }, []);

  async function setBadge(showBadge: boolean) {
    setS((prev) => (prev ? { ...prev, showBadge } : prev));
    const res = await fetch("/api/supporter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showBadge }),
    });
    setMsg(res.ok ? "Saved." : "Couldn't save that.");
  }

  if (!s) return <p className="text-ink/70">Loading…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          <Heart aria-hidden className="h-7 w-7 text-coral" />
          Support OpenHeart
        </h1>
        <p className="mt-2 text-ink/70">
          OpenHeart is free: likes, messages, search, calls and matching never
          cost anything, and never will. Donations are completely optional. They
          help pay for servers and safety tools, and they don&apos;t unlock any
          part of dating on OpenHeart.
        </p>
      </div>

      {s.active ? (
        <section className="rounded-lg border border-forest/15 bg-mist/60 p-5">
          <p className="font-medium text-forest">
            Thank you for supporting OpenHeart.
          </p>
          {s.until && (
            <p className="mt-1 text-sm text-ink/70">
              Your Supporter badge shows until{" "}
              {new Date(s.until).toLocaleDateString()}.
            </p>
          )}
          <label className="mt-4 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={s.showBadge}
              onChange={(e) => setBadge(e.target.checked)}
            />
            <span>
              Show the Supporter badge on my profile
              <span className="block text-ink/70">
                Turn this off if you&apos;d rather nobody knew.
              </span>
            </span>
          </label>
          <p className="mt-3 text-sm text-ink/70">
            To hide the sponsor block on the website, choose &ldquo;No sponsor
            block&rdquo; in{" "}
            <Link href="/settings" className="underline">
              Settings
            </Link>
            .
          </p>
          {msg && (
            <p role="status" className="mt-2 text-sm text-forest">
              {msg}
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-forest/15 bg-cream/60 p-5">
          <h2 className="font-medium text-forest">
            A small thank-you for donors
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/85">
            {s.perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink/70">
            Donations open soon. We&apos;ll post here when they do.
          </p>
        </section>
      )}

      <p className="text-xs text-ink/60">
        Donations are voluntary gifts to OpenHeart, not a membership or a
        purchase, and aren&apos;t tax-deductible. Nobody is ever required to
        donate to use OpenHeart.
      </p>
    </div>
  );
}
