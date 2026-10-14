"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoManager } from "@/components/photo-manager";
import { KinkPicker, type KinkCategory } from "@/components/kink-picker";
import {
  MAX_PROMPT_ANSWER,
  MAX_PROMPTS,
  PROFILE_PROMPTS,
} from "@/lib/constants/prompts";
import type { KinkLevel } from "@/lib/limits";
import { cn } from "@/lib/utils";

type Tag = { id: string; label: string; category?: string };

type TagLink = { tagId: string; tag: { label: string; isCustom?: boolean } };

const ids = (links: TagLink[] | undefined) => (links ?? []).map((l) => l.tagId);

const customTags = (links: TagLink[] | undefined): Tag[] =>
  (links ?? [])
    .filter((l) => l.tag.isCustom)
    .map((l) => ({ id: l.tagId, label: l.tag.label }));

const STEPS = [
  { id: "about", title: "About you" },
  { id: "photos", title: "Photos" },
  { id: "identity", title: "Who you are" },
  { id: "looking", title: "Looking for" },
  { id: "interests", title: "Interests & limits", optional: true },
  { id: "golive", title: "Go live" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

/** Older links pointed at sections of the single-page form. */
const HASH_STEPS: Record<string, StepId> = {
  "#location": "looking",
  "#limits": "interests",
  "#photos": "photos",
};

function OnboardingInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [tags, setTags] = useState<{
    identity: Tag[];
    orientation: Tag[];
    goals: Tag[];
    relationshipStyles: Tag[];
    body: Tag[];
    ethnicity: Tag[];
    accessibility: Tag[];
    kinks: KinkCategory[];
    contentRestricted?: boolean;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<StepId>(() => {
    const s = params.get("step");
    if (STEPS.some((x) => x.id === s)) return s as StepId;
    if (params.get("verify")) return "golive";
    return "about";
  });
  const [identity, setIdentity] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<string[]>([]);
  const [myCustomIdentity, setMyCustomIdentity] = useState<Tag[]>([]);
  const [myCustomOrientation, setMyCustomOrientation] = useState<Tag[]>([]);
  const [customIdentity, setCustomIdentity] = useState("");
  const [customOrientation, setCustomOrientation] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [seeking, setSeeking] = useState<string[]>([]);
  const [seekingOrientation, setSeekingOrientation] = useState<string[]>([]);
  const [bodyTags, setBodyTags] = useState<string[]>([]);
  const [ethnicityTags, setEthnicityTags] = useState<string[]>([]);
  const [accessibilityTags, setAccessibilityTags] = useState<string[]>([]);
  const [kinks, setKinks] = useState<Record<string, KinkLevel>>({});
  const [bio, setBio] = useState("");
  const [limitsNote, setLimitsNote] = useState("");
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
  const [emailVerified, setEmailVerified] = useState(false);
  const [publicPhotos, setPublicPhotos] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadPhotos = useCallback(async () => {
    const res = await fetch("/api/photos");
    if (!res.ok) return;
    const { photos } = (await res.json()) as {
      photos: { visibility: string; status?: string }[];
    };
    setPublicPhotos(
      photos.filter((p) => p.visibility === "PUBLIC" && p.status !== "REJECTED")
        .length,
    );
  }, []);

  const loadProfile = useCallback(async () => {
    const d = await fetch("/api/profile").then((r) => r.json());
    if (d.verification?.status === "VERIFIED_ADULT") setVerified(true);
    setEmailVerified(Boolean(d.emailVerified));
    const p = d.profile;
    if (p) {
      setBio(p.bio ?? "");
      setLimitsNote(p.limitsNote ?? "");
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
      setSeekingOrientation(ids(p.seekingOrientationTags));
      setBodyTags(ids(p.bodyTags));
      setEthnicityTags(ids(p.ethnicityTags));
      setAccessibilityTags(ids(p.accessibilityTags));
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

  const verifyParam = params.get("verify");

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then(setTags)
      .catch(() => setMessage("Could not load tags — is the database seeded?"));
    loadProfile();
    loadPhotos();
    const fromHash = HASH_STEPS[window.location.hash];
    if (fromHash) setStep(fromHash);
  }, [loadProfile, loadPhotos]);

  useEffect(() => {
    if (verifyParam === "success") {
      setVerified(true);
      setMessage("Age verification complete. You can go live now.");
    } else if (verifyParam === "pending") {
      setMessage(
        "Thanks — we're confirming your age now. This usually takes under a minute, and we'll notify you when it's done.",
      );
    }
  }, [verifyParam]);

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function setKinkLevel(kinkId: string, level: KinkLevel | null) {
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
        setMessage("Location captured (rounded to about 1 km).");
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
    const data = await res.json().catch(() => ({}));
    if (data.redirectUrl) window.location.href = data.redirectUrl;
    else setMessage(data.error ?? "Couldn't start verification. Try again.");
  }

  async function resendEmail() {
    const res = await fetch("/api/auth/verify-email", { method: "POST" });
    setEmailSent(res.ok);
    if (!res.ok) setMessage("Couldn't send the email. Try again in a minute.");
  }

  function goTo(id: StepId) {
    setStep(id);
    if (id === "golive") loadPhotos();
    router.replace(`/onboarding?step=${id}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Saves everything; returns whether it worked. */
  async function save(opts: { activate?: boolean; quiet?: boolean } = {}) {
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
        seekingOrientationTagIds: seekingOrientation,
        bodyTagIds: bodyTags,
        ethnicityTagIds: ethnicityTags,
        accessibilityTagIds: accessibilityTags,
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
        limitsNote: limitsNote.trim() || null,
        ...(opts.activate ? { isActive: true } : {}),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(data.error ?? "Save failed");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }
    if (opts.activate && !isActive) {
      router.push("/feed?welcome=1");
      return true;
    }
    setCustomIdentity("");
    setCustomOrientation("");
    await loadProfile();
    const invites = Number(data.newRoomInvites ?? 0);
    if (invites > 0) {
      setMessage(
        `Saved. You have ${invites} new room ${invites === 1 ? "invite" : "invites"} based on your interests.`,
      );
    } else if (!opts.quiet) {
      setMessage("Saved.");
    }
    return true;
  }

  const index = STEPS.findIndex((s) => s.id === step);
  const current = STEPS[index];
  const next = STEPS[index + 1];
  const prev = STEPS[index - 1];

  async function saveAndNext() {
    const ok = step === "photos" ? true : await save({ quiet: true });
    if (ok && next) goTo(next.id);
  }

  if (!tags || !loaded) {
    return <p className="text-ink/70">Loading…</p>;
  }

  const hardLimits = tags.kinks
    .flatMap((c) => c.kinks)
    .filter((k) => kinks[k.id] === "HARD_LIMIT")
    .map((k) => k.name);
  const softLimits = tags.kinks
    .flatMap((c) => c.kinks)
    .filter((k) => kinks[k.id] === "NO")
    .map((k) => k.name);

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        {isActive ? "Edit your profile" : "Set up your profile"}
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        {isActive
          ? "Jump to any section. Changes save when you press Save."
          : "A few short steps. Your progress saves as you go, and you can come back any time."}
      </p>

      <nav aria-label="Profile setup steps" className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/70">
          Step {index + 1} of {STEPS.length}
        </p>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={index + 1}
          aria-label="Setup progress"
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist"
        >
          <div
            className="h-full bg-forest transition-[width] duration-300"
            style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <ol className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(s.id)}
                aria-current={s.id === step ? "step" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs transition-colors",
                  s.id === step
                    ? "bg-forest text-cream"
                    : i < index
                      ? "bg-sage/25 text-forest hover:bg-sage/40"
                      : "bg-mist text-forest hover:bg-sage/30",
                )}
              >
                {i + 1}. {s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {message && (
        <p
          role="status"
          className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {message}
        </p>
      )}

      <section aria-labelledby="step-title" className="mt-6 space-y-6">
        <h2
          id="step-title"
          className="font-[family-name:var(--font-fraunces)] text-2xl text-forest"
        >
          {current.title}
          {"optional" in current && current.optional && (
            <span className="ml-2 align-middle text-sm font-normal text-ink/70">
              optional
            </span>
          )}
        </h2>

        {step === "about" && (
          <>
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
              <p className="mb-1 text-xs text-ink/70">
                A few sentences about you and what you enjoy. Specifics give
                people something to message you about.
              </p>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={5}
                maxLength={2000}
                className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-right text-xs text-ink/70">
                {bio.length}/2000
              </p>
            </div>
            <fieldset className="rounded-md border border-forest/15 bg-cream/50 p-4">
              <legend className="px-1 text-sm font-medium text-forest">
                Profile questions
              </legend>
              <p className="text-sm text-ink/70">
                Pick up to {MAX_PROMPTS}. Good answers make it easy for people
                to start a conversation.
              </p>
              <div className="mt-3 space-y-4">
                {prompts.map((p, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        aria-label={`Question ${i + 1}`}
                        value={p.promptId}
                        onChange={(e) =>
                          setPrompt(i, { promptId: e.target.value })
                        }
                        className="h-11 min-w-0 flex-1 rounded-md border border-forest/15 bg-cream/80 px-3 text-sm"
                      >
                        <option value="">Choose a question…</option>
                        {PROFILE_PROMPTS.filter(
                          (q) =>
                            q.id === p.promptId ||
                            !prompts.some((o) => o.promptId === q.id),
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
                      setPrompts((list) => [
                        ...list,
                        { promptId: "", answer: "" },
                      ])
                    }
                  >
                    Add a question
                  </Button>
                )}
              </div>
            </fieldset>
          </>
        )}

        {step === "photos" && (
          <>
            <p className="text-sm text-ink/70">
              A clear, recent photo of your face helps people feel safe saying
              hi. Photos are checked before anyone else sees them, and their
              location data is removed. You can also keep photos in a private
              album that people have to ask to see.
            </p>
            <PhotoManager
              canAddAdult={verified}
              adultAllowedHere={!tags.contentRestricted}
            />
            <p className="text-sm text-ink/70">
              Later, you can earn the photo-verified badge with a quick selfie
              from your{" "}
              <Link href="/profile#selfie" className="text-forest underline">
                profile page
              </Link>
              .
            </p>
          </>
        )}

        {step === "identity" && (
          <>
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
                aria-label="Write your own identity"
                placeholder="Not listed? Write your own"
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
                aria-label="Write your own orientation"
                placeholder="Not listed? Write your own"
              />
            </div>
            <TagPicker
              title="Relationship style"
              tags={tags.relationshipStyles}
              selected={styles}
              onToggle={(id) => toggle(styles, id, setStyles)}
            />
            <div className="space-y-4 rounded-md border border-forest/15 bg-cream/50 p-4">
              <p className="text-sm text-ink/70">
                Optional. Share only what you&apos;re comfortable with. These
                show on your profile; nobody can filter people out by ethnicity.
              </p>
              {tags.body.length > 0 && (
                <TagPicker
                  title="Body type"
                  tags={tags.body}
                  selected={bodyTags}
                  onToggle={(id) => toggle(bodyTags, id, setBodyTags)}
                />
              )}
              {tags.ethnicity.length > 0 && (
                <TagPicker
                  title="Ethnicity"
                  tags={tags.ethnicity}
                  selected={ethnicityTags}
                  onToggle={(id) => toggle(ethnicityTags, id, setEthnicityTags)}
                />
              )}
              {tags.accessibility.length > 0 && (
                <TagPicker
                  title="Accessibility"
                  tags={tags.accessibility}
                  selected={accessibilityTags}
                  onToggle={(id) =>
                    toggle(accessibilityTags, id, setAccessibilityTags)
                  }
                />
              )}
            </div>
          </>
        )}

        {step === "looking" && (
          <>
            <TagPicker
              title="I'm looking for"
              tags={tags.goals}
              selected={goals}
              onToggle={(id) => toggle(goals, id, setGoals)}
            />
            <div>
              <TagPicker
                title="I'd like to meet"
                tags={tags.identity}
                selected={seeking}
                onToggle={(id) => toggle(seeking, id, setSeeking)}
              />
              <p className="mt-1 text-xs text-ink/70">
                Leave empty to be open to everyone.
              </p>
            </div>
            <div>
              <TagPicker
                title="Orientations I'd like to meet"
                tags={tags.orientation}
                selected={seekingOrientation}
                onToggle={(id) =>
                  toggle(seekingOrientation, id, setSeekingOrientation)
                }
              />
              <p className="mt-1 text-xs text-ink/70">
                Leave empty to be open to everyone.
              </p>
            </div>
            <fieldset
              id="location"
              className="rounded-md border border-forest/15 bg-cream/50 p-4"
            >
              <legend className="px-1 text-sm font-medium text-forest">
                Where
              </legend>
              <p className="text-sm text-ink/70">
                Used only to show approximate distance (like &ldquo;about 10 km
                away&rdquo;). We round it to about 1 km and never show your
                exact spot.
              </p>
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
                <span className="text-xs text-ink/70">
                  {hasCoords ? "Distance is on." : "Or type your city:"}
                </span>
              </div>
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
          </>
        )}

        {step === "interests" && (
          <>
            <p className="text-sm text-ink/70">
              Skip this if you like — you can add interests any time. Anything
              you mark Favorite, Interested or Curious invites you to that
              group&apos;s room. Limits get their own section on your profile,
              and people whose interests clash with them are warned before they
              like you.
            </p>
            <dl className="grid gap-1 text-xs text-ink/70 sm:grid-cols-2">
              <div>
                <dt className="inline font-medium text-forest">Soft limit: </dt>
                <dd className="inline">
                  not for me, or only with a lot of trust and talking first.
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-coral-deep">
                  Hard limit:{" "}
                </dt>
                <dd className="inline">never, not negotiable.</dd>
              </div>
            </dl>
            {tags.contentRestricted && (
              <p className="text-sm text-ink/70">
                The app shows a shorter list. You can see and edit the full list
                on the OpenHeart website, and anything you set there is kept.
              </p>
            )}
            <KinkPicker
              categories={tags.kinks}
              value={kinks}
              onChange={setKinkLevel}
            />
            <fieldset
              id="limits"
              className="space-y-3 rounded-md border border-forest/15 bg-cream/60 p-4"
            >
              <legend className="px-1 text-sm font-medium text-forest">
                Your limits
              </legend>
              <div>
                <p className="text-sm font-medium text-coral-deep">
                  Hard limits
                </p>
                <p className="text-sm text-ink/70">
                  {hardLimits.length > 0
                    ? hardLimits.join(", ")
                    : "None set yet."}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-forest">Soft limits</p>
                <p className="text-sm text-ink/70">
                  {softLimits.length > 0
                    ? softLimits.join(", ")
                    : "None set yet."}
                </p>
              </div>
              <div>
                <Label htmlFor="limitsNote">Anything else? (optional)</Label>
                <textarea
                  id="limitsNote"
                  value={limitsNote}
                  onChange={(e) => setLimitsNote(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
                  placeholder="Boundaries in your own words, e.g. no marks above the collar, no photos during play, safeword is red."
                />
              </div>
            </fieldset>
          </>
        )}

        {step === "golive" && (
          <>
            <div>
              <Label htmlFor="visibility">Who can find you</Label>
              <select
                id="visibility"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3 text-sm"
              >
                <option value="PUBLIC">Everyone — shown in search</option>
                <option value="LIMITED">
                  Only people looking for someone like me
                </option>
                <option value="INCOGNITO">
                  Incognito — hidden until I like or message someone
                </option>
              </select>
              {visibility === "INCOGNITO" && (
                <p className="mt-1 text-xs text-ink/70">
                  You can also share a private link or show your profile to
                  specific people in{" "}
                  <Link href="/settings#incognito" className="underline">
                    Settings
                  </Link>
                  .
                </p>
              )}
            </div>

            {!isActive && (
              <ul className="space-y-3">
                <ChecklistItem
                  done={publicPhotos > 0}
                  title="Add a photo everyone can see"
                  detail="Recommended. Profiles without photos get far fewer replies."
                >
                  {publicPhotos === 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => goTo("photos")}
                    >
                      Add a photo
                    </Button>
                  )}
                </ChecklistItem>
                <ChecklistItem
                  done={emailVerified}
                  title="Confirm your email"
                  detail={
                    emailSent
                      ? "Sent — check your inbox (and spam) for the link."
                      : "We sent you a link when you signed up."
                  }
                >
                  {!emailVerified && !emailSent && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={resendEmail}
                    >
                      Send it again
                    </Button>
                  )}
                </ChecklistItem>
                <ChecklistItem
                  done={verified}
                  title="Verify you're 18 or older"
                  detail="A quick check with our verification partner. We never store your ID — only whether you passed."
                >
                  {!verified && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={startVerify}
                    >
                      Verify my age
                    </Button>
                  )}
                </ChecklistItem>
              </ul>
            )}
          </>
        )}
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-forest/10 pt-6">
        {prev && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => goTo(prev.id)}
            disabled={saving}
          >
            Back
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-3">
          {"optional" in current && current.optional && next && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => goTo(next.id)}
              disabled={saving}
            >
              Skip for now
            </Button>
          )}
          {next ? (
            <Button type="button" onClick={saveAndNext} disabled={saving}>
              {saving ? "Saving…" : "Next"}
            </Button>
          ) : isActive ? (
            <Button type="button" onClick={() => save()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => save()}
                disabled={saving}
              >
                Save and finish later
              </Button>
              <Button
                type="button"
                onClick={() => save({ activate: true })}
                disabled={saving || !verified || !emailVerified}
              >
                Go live &amp; meet people
              </Button>
            </>
          )}
        </div>
      </div>
      {isActive && next && (
        <p className="mt-3 text-right text-xs text-ink/70">
          &ldquo;Next&rdquo; saves your changes.
        </p>
      )}
    </div>
  );
}

function ChecklistItem({
  done,
  title,
  detail,
  children,
}: {
  done: boolean;
  title: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-start gap-3 rounded-md border border-forest/15 bg-cream/60 p-4">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-forest bg-forest text-cream"
            : "border-forest/30 text-transparent",
        )}
      >
        <Check className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-forest">
          {title}
          <span className="sr-only">{done ? " (done)" : " (to do)"}</span>
        </p>
        <p className="text-sm text-ink/70">{done ? "Done." : detail}</p>
      </div>
      {children}
    </li>
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
                  ? "rounded-full bg-forest px-3 py-1.5 text-sm text-cream"
                  : "rounded-full bg-mist px-3 py-1.5 text-sm text-forest hover:bg-sage/30"
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
