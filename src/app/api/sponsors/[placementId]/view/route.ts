import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { allowedTiers, isAppRequest } from "@/lib/content-policy";
import { limitFor } from "@/lib/rate-limit";
import {
  activePlacementWhere,
  parseSeen,
  recordSponsorEvent,
  SEEN_COOKIE,
  serializeSeen,
  sponsorTiers,
  underCap,
} from "@/lib/sponsors";

/** Adds one anonymous view to today's total. Who viewed is never stored. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ placementId: string }> },
) {
  const { placementId } = await params;
  const user = await requireUser();
  if (!user) return new NextResponse(null, { status: 204 });

  const now = new Date();
  const app = await isAppRequest();
  const placement = await prisma.sponsorPlacement.findFirst({
    where: {
      id: placementId,
      ...activePlacementWhere(sponsorTiers(await allowedTiers(user), app), now),
    },
    select: { id: true, dailyCap: true },
  });
  if (!placement) return new NextResponse(null, { status: 204 });

  const jar = await cookies();
  const seen = parseSeen(jar.get(SEEN_COOKIE)?.value, now);
  if (!underCap(placement, seen, app)) {
    return new NextResponse(null, { status: 204 });
  }
  if ((await limitFor("sponsorEventsPerUser", user.id)).ok) {
    await recordSponsorEvent(placement.id, "view", app, now);
  }

  seen[placement.id] = (seen[placement.id] ?? 0) + 1;
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SEEN_COOKIE, serializeSeen(seen, now), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 2 * 24 * 60 * 60,
  });
  return res;
}
