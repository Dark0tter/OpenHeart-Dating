"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const [data, setData] = useState<{
    profile: {
      displayName: string;
      bio: string | null;
      pronouns: string | null;
      visibility: string;
      isActive: boolean;
      identityTags: { tag: { label: string } }[];
      orientationTags: { tag: { label: string } }[];
      goalTags: { tag: { label: string } }[];
    } | null;
    verification: { status: string } | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data?.profile) {
    return <p className="text-ink/60">Loading profile…</p>;
  }

  const p = data.profile;

  return (
    <div className="max-w-xl">
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        {p.displayName}
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        {p.pronouns || "Pronouns not set"} · {p.visibility.toLowerCase()} ·{" "}
        {p.isActive ? "active" : "draft"}
      </p>
      <p className="mt-2 text-sm text-forest">
        Verification: {data.verification?.status ?? "NOT_VERIFIED"}
      </p>
      <p className="mt-6 text-ink/80">{p.bio || "No bio yet."}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ...p.identityTags,
          ...p.orientationTags,
          ...p.goalTags,
        ].map((t, i) => (
          <span
            key={`${t.tag.label}-${i}`}
            className="rounded bg-mist px-2 py-1 text-xs text-forest"
          >
            {t.tag.label}
          </span>
        ))}
      </div>
      <div className="mt-8 flex gap-3">
        <Link href="/onboarding">
          <Button type="button" variant="secondary">
            Edit profile
          </Button>
        </Link>
      </div>
    </div>
  );
}
