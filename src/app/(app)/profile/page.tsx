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
  completeness: {
    percent: number;
    steps: { key: string; label: string; done: boolean }[];
  } | null;
};

const STEP_LINKS: Record<string, string> = {
  photo: "#photos",
  photos3: "#photos",
  selfie: "#selfie",
  email: "/settings",
  location: "/onboarding#location",
};

function Completeness({
  percent,
  steps,
}: NonNullable<ProfileData["completeness"]>) {
  const todo = steps.filter((s) => !s.done);
  if (todo.length === 0) return null;
  return (
    <section
      aria-labelledby="completeness-title"
      className="rounded-lg border border-forest/10 bg-cream/60 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="completeness-title" className="font-medium text-forest">
          Profile strength
        </h2>
        <span className="text-sm text-ink/70">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-labelledby="completeness-title"
        className="mt-2 h-2 overflow-hidden rounded-full bg-mist"
      >
        <div className="h-full bg-forest" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 text-sm text-ink/70">
        Fuller profiles show up higher in &ldquo;Best match&rdquo;. Next steps:
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {todo.slice(0, 4).map((s) => (
          <li key={s.key}>
            <Link
              href={STEP_LINKS[s.key] ?? "/onboarding"}
              className="text-forest underline underline-offset-2"
            >
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

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
    return <p className="text-ink/70">Loading profile…</p>;
  }

  const p = data.profile;
  const verifiedAdult = data.verification?.status === "VERIFIED_ADULT";

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          {p.displayName}
        </h1>
        <p className="mt-1 text-sm text-ink/70">
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

      {data.completeness && <Completeness {...data.completeness} />}

      <div id="photos" className="scroll-mt-24">
        <PhotoManager
          canAddAdult={verifiedAdult}
          adultAllowedHere={!data.contentRestricted}
        />
      </div>
      <div id="selfie" className="scroll-mt-24">
        <SelfieVerify />
      </div>
    </div>
  );
}
