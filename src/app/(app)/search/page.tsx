"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Card = {
  id: string;
  userId: string;
  displayName: string;
  age: number;
  pronouns: string | null;
  bio: string | null;
  location: string | null;
  verified: boolean;
  identity: string[];
  orientation: string[];
  goals: string[];
  relationshipStyles: string[];
  photos: { id: string; url: string }[];
};

export default function SearchPage() {
  const [profiles, setProfiles] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/search");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not load search");
      return;
    }
    setProfiles(data.profiles);
  }

  useEffect(() => {
    load();
  }, []);

  async function like(userId: string) {
    setStatus(null);
    const res = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "Like failed");
      return;
    }
    setStatus(
      data.isMatch ? "It's a match — messaging is free." : "Like sent.",
    );
    setProfiles((p) => p.filter((x) => x.userId !== userId));
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Search
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Incognito members only appear once they have liked you, matched with
        you, or granted you access. Filtering uses identity tags, not binary
        gender logic.
      </p>
      {error && <p className="mt-4 text-sm text-coral-deep">{error}</p>}
      {status && (
        <p className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-forest">
          {status}
        </p>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {profiles.map((p) => (
          <article
            key={p.id}
            className="overflow-hidden rounded-lg border border-forest/10 bg-cream/70"
          >
            <div className="flex h-40 items-end bg-gradient-to-br from-sage/40 to-forest/30 p-4">
              <div>
                <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-cream">
                  {p.displayName}, {p.age}
                </h2>
                {p.pronouns && (
                  <p className="text-sm text-cream/80">{p.pronouns}</p>
                )}
              </div>
            </div>
            <div className="space-y-3 p-4">
              {p.verified && (
                <span className="text-xs font-medium text-forest">
                  Verified adult
                </span>
              )}
              <p className="text-sm text-ink/75 line-clamp-3">
                {p.bio || "No bio yet."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  ...p.identity,
                  ...p.orientation,
                  ...p.goals,
                  ...p.relationshipStyles,
                ]
                  .slice(0, 8)
                  .map((t) => (
                    <span
                      key={t}
                      className="rounded bg-mist px-2 py-0.5 text-xs text-forest"
                    >
                      {t}
                    </span>
                  ))}
              </div>
              <Button type="button" onClick={() => like(p.userId)}>
                Like
              </Button>
            </div>
          </article>
        ))}
      </div>

      {!error && profiles.length === 0 && (
        <p className="mt-10 text-ink/55">
          No profiles yet. Finish onboarding, seed tags, and activate accounts
          to populate search.
        </p>
      )}
    </div>
  );
}
