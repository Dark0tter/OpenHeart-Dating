import Link from "next/link";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/session";
import { allowedTiers, isAppRequest } from "@/lib/content-policy";
import {
  isSafeSponsorUrl,
  parseSeen,
  pickSponsorPlacement,
  SEEN_COOKIE,
} from "@/lib/sponsors";
import { SponsorBeacon } from "@/components/sponsor-beacon";

const LABELS = {
  SPONSOR_SPOTLIGHT: "Sponsor Spotlight",
  COMMUNITY_PARTNER: "Community Partner",
  COMMUNITY_EVENT: "Community Event",
  EDUCATIONAL_RESOURCE: "Educational Resource",
} as const;

/** One small, clearly labelled block at the bottom of the page. Never a popup or takeover. */
export async function SponsorSlot() {
  let placement;
  try {
    const [user, app, jar] = await Promise.all([
      requireUser(),
      isAppRequest(),
      cookies(),
    ]);
    placement = await pickSponsorPlacement(
      user?.id ?? null,
      await allowedTiers(user),
      { app, seen: parseSeen(jar.get(SEEN_COOKIE)?.value, new Date()) },
    );
  } catch {
    return null;
  }
  if (!placement || !isSafeSponsorUrl(placement.linkUrl)) return null;

  return (
    <aside
      aria-label={LABELS[placement.label]}
      className="mx-auto mt-12 max-w-[300px] rounded-md border border-forest/15 bg-cream/70 p-3 text-sm"
    >
      <SponsorBeacon placementId={placement.id} renderId={randomUUID()} />
      <p className="text-[11px] font-medium uppercase tracking-wide text-sage">
        {LABELS[placement.label]} · {placement.sponsorName}
      </p>
      <p className="mt-1 font-medium text-ink">{placement.title}</p>
      {placement.body && (
        <p className="mt-1 line-clamp-3 text-ink/70">{placement.body}</p>
      )}
      <a
        href={`/api/sponsors/${placement.id}/click`}
        target="_blank"
        rel="sponsored noopener noreferrer"
        referrerPolicy="no-referrer"
        className="mt-2 inline-block text-coral hover:text-coral-deep"
      >
        Learn more
      </a>
      <p className="mt-2 text-[11px] text-ink/70">
        Chosen from your profile settings only.{" "}
        <Link href="/privacy" className="underline">
          Why this?
        </Link>
      </p>
    </aside>
  );
}
