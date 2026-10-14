"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Shared = { userId: string; displayName: string; since: string };
type Access = { incognito: boolean; sharePath: string; sharedWith: Shared[] };

export function IncognitoAccess() {
  const [data, setData] = useState<Access | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/profile/access").catch(() => null);
    if (res?.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  if (!data) return null;

  const link = `${window.location.origin}${data.sharePath}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setMsg("Link copied.");
    } catch {
      setMsg("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  async function resetLink() {
    if (!confirm("Make a new link? Anyone with the old link loses access.")) {
      return;
    }
    const res = await fetch("/api/profile/access", { method: "POST" });
    if (res.ok) {
      await load();
      setMsg("New link made. The old one no longer works.");
    } else {
      setMsg("Couldn't make a new link. Please try again.");
    }
  }

  async function hideFrom(s: Shared) {
    const res = await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "revoke",
        otherUserId: s.userId,
        scope: "PROFILE_ACCESS",
      }),
    });
    if (res.ok) {
      setMsg(`Your profile is hidden from ${s.displayName} again.`);
      load();
    } else {
      setMsg("Couldn't change that. Please try again.");
    }
  }

  return (
    <section id="incognito" className="space-y-3">
      <h2 className="font-medium text-forest">Incognito sharing</h2>
      {data.incognito ? (
        <>
          <p className="text-sm text-ink/70">
            Your profile is hidden. People you match with or like can still see
            it. To show it to someone else, send them this private link (they
            must be a verified member to open it), or press &ldquo;Let them see
            my profile&rdquo; on their profile.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={link}
              aria-label="Your private profile link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-forest/20 bg-white px-3 py-2 text-sm"
            />
            <Button type="button" size="sm" variant="secondary" onClick={copy}>
              Copy
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={resetLink}>
              New link
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink/70">
          Your profile is visible to members. Switch to Incognito in{" "}
          <Link href="/onboarding?step=golive" className="underline">
            your profile
          </Link>{" "}
          to choose exactly who sees you.
        </p>
      )}
      {data.sharedWith.length > 0 && (
        <ul className="divide-y divide-forest/10 rounded-lg border border-forest/10">
          {data.sharedWith.map((s) => (
            <li
              key={s.userId}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <Link href={`/members/${s.userId}`} className="hover:underline">
                {s.displayName}
              </Link>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => hideFrom(s)}
              >
                Hide my profile
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
