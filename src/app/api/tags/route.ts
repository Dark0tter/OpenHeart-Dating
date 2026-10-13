import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [
    identity,
    orientation,
    goals,
    relationshipStyles,
    body,
    ethnicity,
    accessibility,
    kinks,
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
    prisma.kinkCategory.findMany({
      orderBy: { name: "asc" },
      include: { kinks: { orderBy: { name: "asc" } } },
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
    kinks,
  });
}
