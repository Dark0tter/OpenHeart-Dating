import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ConsentScope, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/** Who can see an incognito profile: a private link, plus people shared with one by one. */
export async function GET() {
  const user = await requireUser();
  if (!user?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const grants = await prisma.consentGrant.findMany({
    where: {
      granterId: user.id,
      scope: ConsentScope.PROFILE_ACCESS,
      revokedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      viewer: {
        select: { id: true, profile: { select: { displayName: true } } },
      },
    },
  });
  return NextResponse.json({
    incognito: user.profile.visibility === Visibility.INCOGNITO,
    sharePath: `/members/${user.id}?share=${user.profile.shareToken}`,
    sharedWith: grants.map((g) => ({
      userId: g.viewer.id,
      displayName: g.viewer.profile?.displayName ?? "Former member",
      since: g.createdAt,
    })),
  });
}

/** Makes a new private link; the old one stops working straight away. */
export async function POST() {
  const user = await requireUser();
  if (!user?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await prisma.profile.update({
    where: { userId: user.id },
    data: { shareToken: randomUUID() },
    select: { shareToken: true },
  });
  return NextResponse.json({
    sharePath: `/members/${user.id}?share=${profile.shareToken}`,
  });
}
