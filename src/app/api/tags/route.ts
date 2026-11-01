import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { allowedTiers, isRestricted } from "@/lib/content-policy";

export async function GET() {
  const tiers = await allowedTiers(await requireUser());

  const [
    identity,
    orientation,
    goals,
    relationshipStyles,
    body,
    ethnicity,
    accessibility,
    interests,
  ] = await Promise.all([
    prisma.identityTag.findMany({
      where: { isCustom: false },
      orderBy: { label: "asc" },
    }),
    prisma.orientationTag.findMany({
      where: { isCustom: false },
      orderBy: { label: "asc" },
    }),
    prisma.goalTag.findMany({ orderBy: { label: "asc" } }),
    prisma.relationshipStyleTag.findMany({ orderBy: { label: "asc" } }),
    prisma.bodyTag.findMany({
      where: { isCustom: false },
      orderBy: { label: "asc" },
    }),
    prisma.ethnicityTag.findMany({ orderBy: { label: "asc" } }),
    prisma.accessibilityTag.findMany({ orderBy: { label: "asc" } }),
    prisma.interestCategory.findMany({
      where: { tier: { in: tiers } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        interests: {
          where: { tier: { in: tiers } },
          orderBy: { name: "asc" },
          select: { id: true, slug: true, name: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    identity,
    orientation,
    goals,
    relationshipStyles,
    body,
    ethnicity,
    accessibility,
    interests: interests.filter((c) => c.interests.length > 0),
    contentRestricted: isRestricted(tiers),
  });
}
