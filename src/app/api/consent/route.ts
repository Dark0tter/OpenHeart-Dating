import { NextResponse } from "next/server";
import { z } from "zod";
import { ConsentScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isVerifiedAdult } from "@/lib/verification";

const requestSchema = z.object({
  action: z.enum(["request", "grant", "deny", "revoke"]),
  otherUserId: z.string().min(1),
  scope: z.nativeEnum(ConsentScope).default(ConsentScope.ADULT_ALBUM),
});

/**
 * Consent-gated access. ADULT_ALBUM keeps explicit media hidden until the owner
 * accepts; PROFILE_ACCESS lets an incognito owner reveal themselves to one person.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { action, otherUserId, scope } = parsed.data;

  if (otherUserId === user.id) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: user.id, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: user.id },
      ],
    },
  });
  if (blocked && (action === "request" || action === "grant")) {
    return NextResponse.json(
      { error: "Cannot interact with this user" },
      { status: 403 },
    );
  }

  if (
    scope === ConsentScope.ADULT_ALBUM &&
    (action === "request" || action === "grant") &&
    !(await isVerifiedAdult(user.id))
  ) {
    return NextResponse.json(
      { error: "Verified adult status required for adult content." },
      { status: 403 },
    );
  }

  if (action === "request") {
    return NextResponse.json({
      ok: true,
      status: "requested",
      message: "Consent request sent. Content remains hidden until accepted.",
      // Phase 2: persist a ConsentRequest and notify the owner
      toUserId: otherUserId,
      scope,
    });
  }

  if (action === "grant") {
    if (
      scope === ConsentScope.ADULT_ALBUM &&
      !(await isVerifiedAdult(otherUserId))
    ) {
      return NextResponse.json(
        { error: "The viewer must be a verified adult." },
        { status: 403 },
      );
    }
    const grant = await prisma.consentGrant.upsert({
      where: {
        granterId_viewerId_scope: {
          granterId: user.id,
          viewerId: otherUserId,
          scope,
        },
      },
      create: { granterId: user.id, viewerId: otherUserId, scope },
      update: { revokedAt: null },
    });
    return NextResponse.json({ grant });
  }

  await prisma.consentGrant.updateMany({
    where: {
      granterId: user.id,
      viewerId: otherUserId,
      scope,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
