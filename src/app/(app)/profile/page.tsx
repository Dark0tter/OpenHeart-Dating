"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhotoManager } from "@/components/photo-manager";
import { SelfieVerify } from "@/components/selfie-verify";

type ProfileData = {
  profile: {
    userId: string;
    displayName: string;
    bio: string | null;
    pronouns: string | null;
    visibility: string;
    isActive: boolean;
    identityTags: { tag: { label: string } }[];
    orientationTags: { tag: { label: string } }[];
    goalTags: { tag: { label: string } }[];
    relationshipStyleTags: { tag: { label: string } }[];
  } | null;
  verification: { status: string } | null;
  contentRestricted: boolean;
};

const VISIBILITY_TEXT: Record<string, string> = {
  PUBLIC: "Visible to members",
  LIMITED: "Only shown to people looking for someone like you",
  INCOGNITO: "Incognito",
};

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data?.profile) {
    return <p className="text-ink/60">Loading profile…</p>;
  }

  const p = data.profile;
  const verifiedAdult = data.verification?.status === "VERIFIED_ADULT";

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          {p.displayName}
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          {p.pronouns || "Pronouns not set"} ·{" "}
          {VISIBILITY_TEXT[p.visibility] ?? p.visibility} ·{" "}
          {p.isActive ? "Profile is on" : "Profile is off (draft)"}
        </p>
        <p className="mt-2 text-sm text-forest">
          {verifiedAdult ? "Age verified" : "Age not verified yet"}
        </p>
        <p className="mt-6 whitespace-pre-wrap text-ink/80">
          {p.bio || "No bio yet."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ...p.identityTags,
            ...p.orientationTags,
            ...p.goalTags,
            ...p.relationshipStyleTags,
          ].map((t, i) => (
            <span
              key={`${t.tag.label}-${i}`}
              className="rounded bg-mist px-2 py-1 text-xs text-forest"
            >
              {t.tag.label}
            </span>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/onboarding">
            <Button type="button" variant="secondary">
              Edit profile
            </Button>
          </Link>
          <Link href={`/members/${p.userId}`}>
            <Button type="button" variant="ghost">
              See how others see you
            </Button>
          </Link>
          <Link href="/settings">
            <Button type="button" variant="ghost">
              Settings
            </Button>
          </Link>
        </div>
      </div>

      <PhotoManager
        canAddAdult={verifiedAdult}
        adultAllowedHere={!data.contentRestricted}
      />
      <SelfieVerify />
    </div>
  );
}
