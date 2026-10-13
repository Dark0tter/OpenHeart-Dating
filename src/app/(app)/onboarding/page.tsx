"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tag = { id: string; label: string; category?: string };

function OnboardingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [tags, setTags] = useState<{
    identity: Tag[];
    orientation: Tag[];
    goals: Tag[];
  } | null>(null);
  const [identity, setIdentity] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [seeking, setSeeking] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then(setTags)
      .catch(() => setMessage("Could not load tags — is the database seeded?"));
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.verification?.status === "VERIFIED_ADULT") setVerified(true);
      });
    if (params.get("verify") === "success") {
      setVerified(true);
      setMessage("Age verification complete. You can activate your profile.");
    }
  }, [params]);

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function startVerify() {
    const res = await fetch("/api/verification/start", { method: "POST" });
    const data = await res.json();
    if (data.redirectUrl) window.location.href = data.redirectUrl;
  }

  async function save(activate: boolean) {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bio,
        pronouns,
        visibility,
        identityTagIds: identity,
        orientationTagIds: orientation,
        goalTagIds: goals,
        seekingIdentityTagIds: seeking,
        isActive: activate,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "Save failed");
      return;
    }
    if (activate) router.push("/search");
    else setMessage("Profile saved. Verify your age to go live.");
  }

  if (!tags) {
    return <p className="text-ink/60">Loading onboarding…</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Build your profile
      </h1>
      <p className="mt-2 text-sm text-ink/65">
        Identity and attraction use tags — never locked male/female search
        buckets. Completing age verification is required before activation.
      </p>

      {message && (
        <p className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-forest">
          {message}
        </p>
      )}

      <div className="mt-8 space-y-6">
        <div>
          <Label>Pronouns</Label>
          <Input
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            placeholder="they/them"
          />
        </div>
        <div>
          <Label>Bio</Label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
          />
        </div>

        <TagPicker
          title="I identify as"
          tags={tags.identity}
          selected={identity}
          onToggle={(id) => toggle(identity, id, setIdentity)}
        />
        <TagPicker
          title="Orientation"
          tags={tags.orientation}
          selected={orientation}
          onToggle={(id) => toggle(orientation, id, setOrientation)}
        />
        <TagPicker
          title="Looking for"
          tags={tags.goals}
          selected={goals}
          onToggle={(id) => toggle(goals, id, setGoals)}
        />
        <TagPicker
          title="Seeking identities"
          tags={tags.identity}
          selected={seeking}
          onToggle={(id) => toggle(seeking, id, setSeeking)}
        />

        <div>
          <Label>Visibility</Label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3 text-sm"
          >
            <option value="PUBLIC">Public — visible in search</option>
            <option value="LIMITED">
              Limited — preference-group visibility only
            </option>
            <option value="INCOGNITO">
              Incognito — not searchable; appears when you engage
            </option>
          </select>
        </div>

        <div className="rounded-md border border-forest/15 bg-cream/60 p-4">
          <p className="font-medium text-forest">Age verification</p>
          <p className="mt-1 text-sm text-ink/60">
            Required before profile activation. We store a verification token
            and status only — never ID images.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={startVerify}
              disabled={verified}
            >
              {verified ? "Verified adult" : "Start verification (stub)"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" onClick={() => save(false)} disabled={saving}>
            Save draft
          </Button>
          <Button
            type="button"
            onClick={() => save(true)}
            disabled={saving || !verified}
          >
            Activate & search
          </Button>
        </div>
      </div>
    </div>
  );
}

function TagPicker({
  title,
  tags,
  selected,
  onToggle,
}: {
  title: string;
  tags: Tag[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-forest">{title}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              className={
                on
                  ? "rounded-md bg-forest px-3 py-1.5 text-xs text-cream"
                  : "rounded-md bg-mist px-3 py-1.5 text-xs text-forest hover:bg-sage/30"
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  );
}
