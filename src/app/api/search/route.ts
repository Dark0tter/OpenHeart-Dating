import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { searchProfiles } from "@/lib/discovery";
import { ageFromDob } from "@/lib/utils";

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

  const profiles = await searchProfiles({
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
      num(searchParams.get("distance")) ?? user.profile.radiusKm,
    verifiedOnly: searchParams.get("verified") === "1",
    cursor: searchParams.get("cursor") ?? undefined,
    limit: num(searchParams.get("limit")) ?? 24,
  });

  return NextResponse.json({
    profiles: profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      pronouns: p.pronouns,
      bio: p.bio,
      age: ageFromDob(p.user.dateOfBirth),
      location: [p.city, p.state, p.country].filter(Boolean).join(", ") || null,
      visibility: p.visibility,
      verified: p.user.verification?.status === "VERIFIED_ADULT",
      identity: p.identityTags.map((t) => t.tag.label),
      orientation: p.orientationTags.map((t) => t.tag.label),
      goals: p.goalTags.map((t) => t.tag.label),
      photos: p.photos.map((ph) => ({
        id: ph.id,
        url: ph.url,
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
