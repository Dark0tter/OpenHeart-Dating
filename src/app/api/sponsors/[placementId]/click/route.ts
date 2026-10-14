import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { allowedTiers, isAppRequest } from "@/lib/content-policy";
import { limitFor } from "@/lib/rate-limit";
import { appUrl } from "@/lib/request";
import {
  activePlacementWhere,
  isSafeSponsorUrl,
  recordSponsorEvent,
  sponsorTiers,
} from "@/lib/sponsors";

/**
 * Counts one anonymous click, then sends the member to the sponsor. Only the
 * placement's own stored link is ever used, and no referrer is passed on.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ placementId: string }> },
) {
  const { placementId } = await params;
  const now = new Date();
  const [user, app] = await Promise.all([requireUser(), isAppRequest()]);
  const placement = await prisma.sponsorPlacement.findFirst({
    where: {
      id: placementId,
      ...activePlacementWhere(sponsorTiers(await allowedTiers(user), app), now),
    },
    select: { id: true, linkUrl: true },
  });
  if (!placement || !isSafeSponsorUrl(placement.linkUrl)) {
    return NextResponse.redirect(`${appUrl()}/feed`, 302);
  }

  if (user && (await limitFor("sponsorEventsPerUser", user.id)).ok) {
    await recordSponsorEvent(placement.id, "click", app, now);
  }

  const res = NextResponse.redirect(placement.linkUrl, 302);
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  return res;
}
