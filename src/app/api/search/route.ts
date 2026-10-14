import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { searchProfiles, type SearchSort } from "@/lib/discovery";
import { activityLabel, ageFromDob, approxDistanceLabel } from "@/lib/utils";
import { photoSrc } from "@/lib/photos";
import { allowedTiers, isAppRequest } from "@/lib/content-policy";
import { textFilterFor } from "@/lib/moderation/app-text";
import { supporterBadges } from "@/lib/supporter";

const SORTS: SearchSort[] = ["best", "recent", "nearest"];

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parseList = (key: string) => {
    const v = searchParams.get(key);
    return v ? v.split(",").filter(Boolean) : undefined;
  };
  const sortParam = searchParams.get("sort") as SearchSort | null;
  const distanceParam = searchParams.get("distance");

  const filterText = textFilterFor(await allowedTiers(user));
  const { results, hasMore } = await searchProfiles({
    viewerUserId: user.id,
    viewerLat: user.profile.latitude,
    viewerLng: user.profile.longitude,
    identityTagIds: parseList("identity"),
    orientationTagIds: parseList("orientation"),
    goalTagIds: parseList("goals"),
    kinkIds: parseList("kinks"),
    minAge: num(searchParams.get("minAge")),
    maxAge: num(searchParams.get("maxAge")),
    maxDistanceKm:
      distanceParam === "any"
        ? undefined
        : (num(distanceParam) ?? user.profile.radiusKm),
    verifiedOnly: searchParams.get("verified") === "1",
    photoVerifiedOnly: searchParams.get("photoVerified") === "1",
    hasPhoto: searchParams.get("hasPhoto") === "1",
    hideHardClashes: searchParams.get("noClashes") === "1",
    sort: sortParam && SORTS.includes(sortParam) ? sortParam : "best",
    page: num(searchParams.get("page")) ?? 0,
    limit: num(searchParams.get("limit")) ?? 24,
  });
  const supporters = (await isAppRequest())
    ? new Set<string>()
    : await supporterBadges(results.map((r) => r.profile.userId));

  return NextResponse.json({
    hasLocation: user.profile.latitude != null,
    hasMore,
    profiles: results.map(({ profile: p, km, hardClashes }) => ({
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      pronouns: p.pronouns,
      bio: p.bio ? filterText(p.bio) : null,
      hardClashes,
      age: ageFromDob(p.user.dateOfBirth),
      location: [p.city, p.state].filter(Boolean).join(", ") || null,
      distance: km != null ? approxDistanceLabel(km) : null,
      activity: activityLabel(p.user.lastActiveAt),
      visibility: p.visibility,
      verified: p.user.verification?.status === "VERIFIED_ADULT",
      photoVerified: Boolean(p.user.photoVerifiedAt),
      supporter: supporters.has(p.userId),
      identity: p.identityTags.map((t) => t.tag.label),
      orientation: p.orientationTags.map((t) => t.tag.label),
      goals: p.goalTags.map((t) => t.tag.label),
      relationshipStyles: p.relationshipStyleTags.map((t) => t.tag.label),
      photos: p.photos.map((ph) => ({
        id: ph.id,
        url: photoSrc(ph.id, "thumb"),
        isPrimary: ph.isPrimary,
      })),
    })),
  });
}

function num(v: string | null): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
