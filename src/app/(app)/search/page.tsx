"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Card = {
  id: string;
  userId: string;
  displayName: string;
  age: number;
  pronouns: string | null;
  bio: string | null;
  location: string | null;
  distance: string | null;
  activity: string;
  verified: boolean;
  photoVerified: boolean;
  identity: string[];
  orientation: string[];
  goals: string[];
  relationshipStyles: string[];
  photos: { id: string; url: string }[];
};

type Filters = {
  sort: "best" | "recent" | "nearest";
  minAge: string;
  maxAge: string;
  distance: string;
  verified: boolean;
  photoVerified: boolean;
  hasPhoto: boolean;
};

const DEFAULT_FILTERS: Filters = {
  sort: "best",
  minAge: "",
  maxAge: "",
  distance: "",
  verified: false,
  photoVerified: false,
  hasPhoto: false,
};

const DISTANCES = [
  { value: "", label: "My usual distance" },
  { value: "10", label: "Within 10 km" },
  { value: "25", label: "Within 25 km" },
  { value: "50", label: "Within 50 km" },
  { value: "100", label: "Within 100 km" },
  { value: "250", label: "Within 250 km" },
  { value: "any", label: "Any distance" },
];

function query(f: Filters, page: number) {
  const q = new URLSearchParams({ sort: f.sort, page: String(page) });
  if (f.minAge) q.set("minAge", f.minAge);
  if (f.maxAge) q.set("maxAge", f.maxAge);
  if (f.distance) q.set("distance", f.distance);
  if (f.verified) q.set("verified", "1");
  if (f.photoVerified) q.set("photoVerified", "1");
  if (f.hasPhoto) q.set("hasPhoto", "1");
  return q.toString();
}

export default function SearchPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [profiles, setProfiles] = useState<Card[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [hasLocation, setHasLocation] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    const res = await fetch(`/api/search?${query(f, p)}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Could not load search");
      return;
    }
    setError(null);
    setHasMore(data.hasMore);
    setHasLocation(data.hasLocation);
    setProfiles((prev) =>
      p === 0 ? data.profiles : [...prev, ...data.profiles],
    );
    setPage(p);
  }, []);

  useEffect(() => {
    load(filters, 0);
  }, [filters, load]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

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
    setStatus(data.isMatch ? "It's a match! Messaging is free." : "Like sent.");
    setProfiles((p) => p.filter((x) => x.userId !== userId));
  }

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Search
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        &ldquo;Best match&rdquo; weighs who you&apos;re each looking for, shared
        goals and interests, limits, distance, and recent activity. Incognito
        members only appear once they&apos;ve liked you, matched with you, or
        given you access.
      </p>

      {!hasLocation && (
        <p className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-forest">
          Set your location in{" "}
          <Link href="/onboarding#location" className="underline">
            your profile
          </Link>{" "}
          to see distances and sort by nearest.
        </p>
      )}

      <details
        className="mt-6 rounded-lg border border-forest/10 bg-cream/60 p-4"
        open
      >
        <summary className="cursor-pointer font-medium text-forest">
          Filters
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="block text-ink/70">Sort by</span>
            <select
              value={filters.sort}
              onChange={(e) => set("sort", e.target.value as Filters["sort"])}
              className="mt-1 h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3"
            >
              <option value="best">Best match</option>
              <option value="recent">Recently active</option>
              <option value="nearest" disabled={!hasLocation}>
                Nearest
              </option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-ink/70">Distance</span>
            <select
              value={filters.distance}
              onChange={(e) => set("distance", e.target.value)}
              className="mt-1 h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3"
            >
              {DISTANCES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-sm">
            <legend className="text-ink/70">Age</legend>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={18}
                max={99}
                inputMode="numeric"
                aria-label="Minimum age"
                placeholder="18"
                value={filters.minAge}
                onChange={(e) => set("minAge", e.target.value)}
                className="h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3"
              />
              <span aria-hidden>to</span>
              <input
                type="number"
                min={18}
                max={99}
                inputMode="numeric"
                aria-label="Maximum age"
                placeholder="99"
                value={filters.maxAge}
                onChange={(e) => set("maxAge", e.target.value)}
                className="h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3"
              />
            </div>
          </fieldset>
          <fieldset className="space-y-1 text-sm">
            <legend className="text-ink/70">Only show</legend>
            {(
              [
                ["hasPhoto", "Members with photos"],
                ["photoVerified", "Photo verified"],
                ["verified", "Age verified"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters[key]}
                  onChange={(e) => set(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
      </details>

      {error && <p className="mt-4 text-sm text-coral-deep">{error}</p>}
      {status && (
        <p
          role="status"
          className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {status}
        </p>
      )}

      <ul className="mt-8 grid gap-6 sm:grid-cols-2">
        {profiles.map((p) => {
          const photo = p.photos[0];
          return (
            <li
              key={p.id}
              className="overflow-hidden rounded-lg border border-forest/10 bg-cream/70"
            >
              <Link href={`/members/${p.userId}`} className="group block">
                <div className="relative aspect-[4/3] bg-gradient-to-br from-sage/40 to-forest/30">
                  {photo && (
                    <Image
                      src={photo.url}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-4">
                    <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-cream group-hover:underline">
                      {p.displayName}, {p.age}
                    </h2>
                    <p className="text-sm text-cream/85">
                      {[p.pronouns, p.distance ?? p.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              </Link>
              <div className="space-y-3 p-4">
                <p className="flex flex-wrap gap-2 text-xs">
                  <span className="text-ink/70">{p.activity}</span>
                  {p.photoVerified && (
                    <span className="font-medium text-forest">
                      Photo verified
                    </span>
                  )}
                  {p.verified && (
                    <span className="font-medium text-forest">
                      Age verified
                    </span>
                  )}
                </p>
                <p className="line-clamp-3 text-sm text-ink/75">
                  {p.bio || "No bio yet."}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {[
                    ...p.identity,
                    ...p.orientation,
                    ...p.goals,
                    ...p.relationshipStyles,
                  ]
                    .slice(0, 8)
                    .map((t) => (
                      <li
                        key={t}
                        className="rounded bg-mist px-2 py-0.5 text-xs text-forest"
                      >
                        {t}
                      </li>
                    ))}
                </ul>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => like(p.userId)}>
                    Like
                  </Button>
                  <Link href={`/members/${p.userId}`}>
                    <Button type="button" variant="ghost">
                      View profile
                    </Button>
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="mt-8 text-center">
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => load(filters, page + 1)}
          >
            {loading ? "Loading…" : "Show more"}
          </Button>
        </div>
      )}

      {!error && !loading && profiles.length === 0 && (
        <p className="mt-10 text-ink/70">
          Nobody matches these filters yet. Try a wider distance or fewer
          filters.
        </p>
      )}
    </div>
  );
}
