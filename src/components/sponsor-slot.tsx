import Link from "next/link";
import { requireUser } from "@/lib/session";
import { allowedTiers } from "@/lib/content-policy";
import { pickSponsorPlacement } from "@/lib/sponsors";

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
    const user = await requireUser();
    placement = await pickSponsorPlacement(
      user?.id ?? null,
      await allowedTiers(user),
    );
  } catch {
    return null;
  }
  if (!placement || !isSafeUrl(placement.linkUrl)) return null;

  return (
    <aside
      aria-label={LABELS[placement.label]}
      className="mx-auto mt-12 max-w-[300px] rounded-md border border-forest/15 bg-cream/70 p-3 text-sm"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-sage">
        {LABELS[placement.label]} · {placement.sponsorName}
      </p>
      <p className="mt-1 font-medium text-ink">{placement.title}</p>
      {placement.body && (
        <p className="mt-1 line-clamp-3 text-ink/70">{placement.body}</p>
      )}
      <a
        href={placement.linkUrl}
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

function isSafeUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
