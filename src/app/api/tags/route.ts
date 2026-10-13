import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [
    identity,
    orientation,
    goals,
    body,
    ethnicity,
    accessibility,
    kinks,
  ] = await Promise.all([
    prisma.identityTag.findMany({ orderBy: { label: "asc" } }),
    prisma.orientationTag.findMany({ orderBy: { label: "asc" } }),
    prisma.goalTag.findMany({ orderBy: { label: "asc" } }),
    prisma.bodyTag.findMany({ orderBy: { label: "asc" } }),
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
    body,
    ethnicity,
    accessibility,
    kinks,
  });
}
