"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Tag = { id: string; label: string; category?: string };
type KinkCategory = {
  id: string;
  name: string;
  description: string | null;
  kinks: { id: string; name: string }[];
};
type KinkLevel = "FAVORITE" | "INTERESTED" | "CURIOUS" | "NO" | "HARD_LIMIT";

const KINK_LEVELS: { value: KinkLevel; label: string }[] = [
  { value: "FAVORITE", label: "Favorite" },
  { value: "INTERESTED", label: "Interested" },
  { value: "CURIOUS", label: "Curious" },
  { value: "NO", label: "No" },
  { value: "HARD_LIMIT", label: "Hard limit" },
];

type TagLink = { tagId: string; tag: { label: string; isCustom?: boolean } };

const ids = (links: TagLink[] | undefined) => (links ?? []).map((l) => l.tagId);

const customTags = (links: TagLink[] | undefined): Tag[] =>
  (links ?? [])
    .filter((l) => l.tag.isCustom)
    .map((l) => ({ id: l.tagId, label: l.tag.label }));

function OnboardingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [tags, setTags] = useState<{
    identity: Tag[];
    orientation: Tag[];
    goals: Tag[];
    relationshipStyles: Tag[];
    kinks: KinkCategory[];
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [identity, setIdentity] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<string[]>([]);
  const [myCustomIdentity, setMyCustomIdentity] = useState<Tag[]>([]);
  const [myCustomOrientation, setMyCustomOrientation] = useState<Tag[]>([]);
  const [customIdentity, setCustomIdentity] = useState("");
  const [customOrientation, setCustomOrientation] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [seeking, setSeeking] = useState<string[]>([]);
  const [kinks, setKinks] = useState<Record<string, KinkLevel>>({});
  const [bio, setBio] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [isActive, setIsActive] = useState(false);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    const d = await fetch("/api/profile").then((r) => r.json());
    if (d.verification?.status === "VERIFIED_ADULT") setVerified(true);
    const p = d.profile;
    if (p) {
      setBio(p.bio ?? "");
      setPronouns(p.pronouns ?? "");
      setVisibility(p.visibility ?? "PUBLIC");
      setIsActive(Boolean(p.isActive));
      setIdentity(ids(p.identityTags));
      setOrientation(ids(p.orientationTags));
      setMyCustomIdentity(customTags(p.identityTags));
      setMyCustomOrientation(customTags(p.orientationTags));
      setGoals(ids(p.goalTags));
      setStyles(ids(p.relationshipStyleTags));
      setSeeking(ids(p.seekingIdentityTags));
      setKinks(
        Object.fromEntries(
          (p.kinks ?? []).map((k: { kinkId: string; level: KinkLevel }) => [
            k.kinkId,
            k.level,
          ]),
        ),
      );
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then(setTags)
      .catch(() => setMessage("Could not load tags — is the database seeded?"));
    loadProfile();
    if (params.get("verify") === "success") {
      setVerified(true);
      setMessage("Age verification complete. You can activate your profile.");
    }
  }, [params, loadProfile]);

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function setKinkLevel(kinkId: string, level: KinkLevel | "") {
    setKinks((prev) => {
      const next = { ...prev };
      if (level) next[kinkId] = level;
      else delete next[kinkId];
      return next;
    });
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
        relationshipStyleTagIds: styles,
        seekingIdentityTagIds: seeking,
        ...(customIdentity.trim()
          ? { customIdentity: customIdentity.trim() }
          : {}),
        ...(customOrientation.trim()
          ? { customOrientation: customOrientation.trim() }
          : {}),
        kinks: Object.entries(kinks).map(([kinkId, level]) => ({
          kinkId,
          level,
        })),
        ...(activate ? { isActive: true } : {}),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "Save failed");
      return;
    }
    if (activate && !isActive) {
      router.push("/rooms");
      return;
    }
    setCustomIdentity("");
    setCustomOrientation("");
    await loadProfile();
    const invites = Number(data.newRoomInvites ?? 0);
    setMessage(
      isActive
        ? invites > 0
          ? `Saved. You have ${invites} new room ${invites === 1 ? "invite" : "invites"} based on your interests.`
          : "Saved."
        : "Profile saved. Verify your age to go live.",
    );
  }

  if (!tags || !loaded) {
    return <p className="text-ink/60">Loading onboarding…</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        {isActive ? "Edit your profile" : "Build your profile"}
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

        <div>
          <TagPicker
            title="I identify as"
            tags={[...tags.identity, ...myCustomIdentity]}
            selected={identity}
            onToggle={(id) => toggle(identity, id, setIdentity)}
          />
          <Input
            className="mt-2"
            value={customIdentity}
            onChange={(e) => setCustomIdentity(e.target.value)}
            maxLength={40}
            placeholder="Not listed? Write your own (added when you save)"
          />
        </div>
        <div>
          <TagPicker
            title="Orientation"
            tags={[...tags.orientation, ...myCustomOrientation]}
            selected={orientation}
            onToggle={(id) => toggle(orientation, id, setOrientation)}
          />
          <Input
            className="mt-2"
            value={customOrientation}
            onChange={(e) => setCustomOrientation(e.target.value)}
            maxLength={40}
            placeholder="Not listed? Write your own (added when you save)"
          />
        </div>
        <TagPicker
          title="Looking for"
          tags={tags.goals}
          selected={goals}
          onToggle={(id) => toggle(goals, id, setGoals)}
        />
        <TagPicker
          title="Relationship style"
          tags={tags.relationshipStyles}
          selected={styles}
          onToggle={(id) => toggle(styles, id, setStyles)}
        />
        <TagPicker
          title="Seeking identities"
          tags={tags.identity}
          selected={seeking}
          onToggle={(id) => toggle(seeking, id, setSeeking)}
        />

        <div>
          <p className="text-sm font-medium text-forest">
            Interests &amp; kinks
          </p>
          <p className="mt-1 text-sm text-ink/60">
            Optional. Anything you mark Favorite, Interested or Curious gets you
            invited to that group&apos;s room. No and Hard limit are shown on
            your profile so others know your boundaries.
          </p>
          <div className="mt-3 space-y-2">
            {tags.kinks.map((cat) => {
              const chosen = cat.kinks.filter((k) => kinks[k.id]).length;
              return (
                <details
                  key={cat.id}
                  className="rounded-md border border-forest/10 bg-cream/50 px-3 py-2"
                >
                  <summary className="cursor-pointer text-sm text-forest">
                    {cat.name}
                    {chosen > 0 && (
                      <span className="ml-2 text-xs text-ink/50">
                        {chosen} selected
                      </span>
                    )}
                  </summary>
                  {cat.description && (
                    <p className="mt-2 rounded bg-mist px-2 py-1.5 text-xs text-forest">
                      {cat.description}
                    </p>
                  )}
                  <ul className="mt-2 space-y-1">
                    {cat.kinks.map((k) => (
                      <li
                        key={k.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-ink">{k.name}</span>
                        <select
                          value={kinks[k.id] ?? ""}
                          onChange={(e) =>
                            setKinkLevel(k.id, e.target.value as KinkLevel | "")
                          }
                          className="h-8 rounded-md border border-forest/15 bg-cream/80 px-2 text-xs"
                        >
                          <option value="">—</option>
                          {KINK_LEVELS.map((l) => (
                            <option key={l.value} value={l.value}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </div>

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

        {!isActive && (
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
                {verified ? "Verified adult" : "Start verification"}
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {isActive ? (
            <Button type="button" onClick={() => save(false)} disabled={saving}>
              Save changes
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => save(false)}
                disabled={saving}
              >
                Save draft
              </Button>
              <Button
                type="button"
                onClick={() => save(true)}
                disabled={saving || !verified}
              >
                Activate &amp; meet people
              </Button>
            </>
          )}
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
