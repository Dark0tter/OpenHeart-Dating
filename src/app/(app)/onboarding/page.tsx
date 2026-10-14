"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_PROMPT_ANSWER,
  MAX_PROMPTS,
  PROFILE_PROMPTS,
} from "@/lib/constants/prompts";

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
    contentRestricted?: boolean;
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
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [radiusKm, setRadiusKm] = useState(50);
  const [hasCoords, setHasCoords] = useState(false);
  const [browserCoords, setBrowserCoords] = useState<
    { latitude: number; longitude: number } | null | undefined
  >(undefined);
  const [locating, setLocating] = useState(false);
  const [prompts, setPrompts] = useState<
    { promptId: string; answer: string }[]
  >([]);
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
      setCity(p.city ?? "");
      setRegion(p.state ?? "");
      setCountry(p.country ?? "");
      setRadiusKm(p.radiusKm ?? 50);
      setHasCoords(p.latitude != null);
      setBrowserCoords(undefined);
      setPrompts(
        (p.prompts ?? []).map((q: { promptId: string; answer: string }) => ({
          promptId: q.promptId,
          answer: q.answer,
        })),
      );
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
    } else if (params.get("verify") === "pending") {
      setMessage(
        "Thanks — we're confirming your age now. This usually takes under a minute, and we'll notify you when it's done.",
      );
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

  function shareLocation() {
    if (!navigator.geolocation) {
      setMessage("Your browser can't share location. Type your city instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setBrowserCoords({
          latitude: Math.round(pos.coords.latitude * 100) / 100,
          longitude: Math.round(pos.coords.longitude * 100) / 100,
        });
        setHasCoords(true);
        setMessage(
          "Location captured (rounded to about 1 km). Save to keep it.",
        );
      },
      () => {
        setLocating(false);
        setMessage(
          "Location permission was denied. You can type your city instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }

  function clearLocation() {
    setBrowserCoords(null);
    setHasCoords(false);
    setCity("");
    setRegion("");
    setCountry("");
  }

  function setPrompt(
    index: number,
    patch: Partial<{ promptId: string; answer: string }>,
  ) {
    setPrompts((list) =>
      list.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
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
        city: city.trim() || null,
        state: region.trim() || null,
        country: country.trim() || null,
        radiusKm,
        ...(browserCoords !== undefined
          ? {
              latitude: browserCoords?.latitude ?? null,
              longitude: browserCoords?.longitude ?? null,
            }
          : {}),
        prompts: prompts
          .filter((p) => p.promptId && p.answer.trim())
          .map((p) => ({ promptId: p.promptId, answer: p.answer.trim() })),
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
        <p
          role="status"
          className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {message}
        </p>
      )}

      <div className="mt-8 space-y-6">
        <div>
          <Label htmlFor="pronouns">Pronouns</Label>
          <Input
            id="pronouns"
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            placeholder="they/them"
          />
        </div>
        <div>
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
          />
        </div>

        <fieldset
          id="location"
          className="scroll-mt-24 rounded-md border border-forest/15 bg-cream/50 p-4"
        >
          <legend className="px-1 text-sm font-medium text-forest">
            Location
          </legend>
          <p className="text-sm text-ink/60">
            Used only to show approximate distance (like &ldquo;about 10 km
            away&rdquo;). We round it to about 1 km and never show your exact
            spot.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={80}
                autoComplete="address-level2"
              />
            </div>
            <div>
              <Label htmlFor="region">State / region</Label>
              <Input
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                maxLength={80}
                autoComplete="address-level1"
              />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                maxLength={80}
                autoComplete="country-name"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={shareLocation}
              disabled={locating}
            >
              {locating ? "Finding you…" : "Use my current location"}
            </Button>
            {(hasCoords || city) && (
              <Button type="button" variant="ghost" onClick={clearLocation}>
                Remove location
              </Button>
            )}
            <span className="text-xs text-ink/55">
              {hasCoords
                ? "Distance is on."
                : "Type a city or share your location to see distances."}
            </span>
          </div>
          <div className="mt-3">
            <Label htmlFor="radius">Usual search distance</Label>
            <select
              id="radius"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3 text-sm"
            >
              {[10, 25, 50, 100, 250, 500].map((km) => (
                <option key={km} value={km}>
                  Within {km} km
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset className="rounded-md border border-forest/15 bg-cream/50 p-4">
          <legend className="px-1 text-sm font-medium text-forest">
            Profile questions
          </legend>
          <p className="text-sm text-ink/60">
            Pick up to {MAX_PROMPTS}. Good answers give people something easy to
            message you about.
          </p>
          <div className="mt-3 space-y-4">
            {prompts.map((p, i) => (
              <div key={i} className="space-y-2">
                <div className="flex gap-2">
                  <select
                    aria-label={`Question ${i + 1}`}
                    value={p.promptId}
                    onChange={(e) => setPrompt(i, { promptId: e.target.value })}
                    className="h-11 min-w-0 flex-1 rounded-md border border-forest/15 bg-cream/80 px-3 text-sm"
                  >
                    <option value="">Choose a question…</option>
                    {PROFILE_PROMPTS.filter(
                      (q) =>
                        q.id === p.promptId ||
                        !prompts.some((other) => other.promptId === q.id),
                    ).map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.question}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setPrompts((list) => list.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </Button>
                </div>
                <textarea
                  aria-label={`Answer ${i + 1}`}
                  value={p.answer}
                  onChange={(e) => setPrompt(i, { answer: e.target.value })}
                  rows={2}
                  maxLength={MAX_PROMPT_ANSWER}
                  className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
                />
              </div>
            ))}
            {prompts.length < MAX_PROMPTS && (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setPrompts((list) => [...list, { promptId: "", answer: "" }])
                }
              >
                Add a question
              </Button>
            )}
          </div>
        </fieldset>

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
          {tags.contentRestricted && (
            <p className="mt-2 text-sm text-ink/60">
              The app shows a shorter list. You can see and edit the full list
              on the OpenHeart website, and anything you set there is kept.
            </p>
          )}
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
                          aria-label={k.name}
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
          <Label htmlFor="visibility">Visibility</Label>
          <select
            id="visibility"
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
    <div role="group" aria-label={title}>
      <p className="mb-2 text-sm font-medium text-forest">{title}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
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
