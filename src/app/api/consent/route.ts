import { NextResponse } from "next/server";
import { z } from "zod";
import { ConsentScope, MessageRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isVerifiedAdult } from "@/lib/verification";
import { isBlockedEitherWay } from "@/lib/safety";
import { photoSrc, primaryPhotoWhere } from "@/lib/photos";

const ALBUM_SCOPES = [
  ConsentScope.PRIVATE_ALBUM,
  ConsentScope.ADULT_ALBUM,
] as const;
const DECLINE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum(["request", "grant", "revoke", "deny"]),
    otherUserId: z.string().min(1),
    scope: z.nativeEnum(ConsentScope).default(ConsentScope.PRIVATE_ALBUM),
  }),
  z.object({
    action: z.literal("respond"),
    requestId: z.string().min(1),
    accept: z.boolean(),
  }),
]);

const personSelect = {
  id: true,
  profile: {
    select: {
      displayName: true,
      photos: { where: primaryPhotoWhere(), take: 1, select: { id: true } },
    },
  },
} as const;

function person(u: {
  id: string;
  profile: { displayName: string; photos: { id: string }[] } | null;
}) {
  const photo = u.profile?.photos[0];
  return {
    id: u.id,
    displayName: u.profile?.displayName ?? "Member",
    photo: photo ? photoSrc(photo.id, "thumb") : null,
  };
}

/** Incoming requests, my outgoing requests, and who I've shared albums with. */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [incoming, outgoing, grants] = await Promise.all([
    prisma.consentRequest.findMany({
      where: { ownerId: user.id, status: MessageRequestStatus.PENDING },
      orderBy: { createdAt: "desc" },
      include: { requester: { select: personSelect } },
    }),
    prisma.consentRequest.findMany({
      where: { requesterId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { owner: { select: personSelect } },
    }),
    prisma.consentGrant.findMany({
      where: {
        granterId: user.id,
        revokedAt: null,
        scope: { in: [...ALBUM_SCOPES] },
      },
      orderBy: { createdAt: "desc" },
      include: { viewer: { select: personSelect } },
    }),
  ]);

  return NextResponse.json({
    incoming: incoming.map((r) => ({
      id: r.id,
      scope: r.scope,
      createdAt: r.createdAt,
      from: person(r.requester),
    })),
    outgoing: outgoing.map((r) => ({
      id: r.id,
      scope: r.scope,
      status: r.status,
      to: person(r.owner),
    })),
    sharedWith: grants.map((g) => ({
      scope: g.scope,
      since: g.createdAt,
      viewer: person(g.viewer),
    })),
  });
}

/**
 * Consent-gated access. PRIVATE_ALBUM and ADULT_ALBUM stay hidden until the
 * owner accepts a request or shares them; PROFILE_ACCESS lets an incognito
 * owner reveal themselves to one person. Owners can revoke at any time.
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
  const body = parsed.data;

  if (body.action === "respond") {
    const request = await prisma.consentRequest.findFirst({
      where: { id: body.requestId, ownerId: user.id },
    });
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (body.accept) {
      const error = await grantError(
        user.id,
        request.requesterId,
        request.scope,
      );
      if (error) return NextResponse.json({ error }, { status: 403 });
      await grant(user.id, request.requesterId, request.scope);
    }
    await prisma.consentRequest.update({
      where: { id: request.id },
      data: {
        status: body.accept
          ? MessageRequestStatus.ACCEPTED
          : MessageRequestStatus.DENIED,
        respondedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  }

  const { action, otherUserId, scope } = body;
  if (otherUserId === user.id) {
    return NextResponse.json({ error: "Invalid target" }, { status: 400 });
  }

  if (action === "request") {
    if (await isBlockedEitherWay(user.id, otherUserId)) {
      return NextResponse.json(
        { error: "Cannot interact with this user" },
        { status: 403 },
      );
    }
    if (
      scope === ConsentScope.ADULT_ALBUM &&
      !(await isVerifiedAdult(user.id))
    ) {
      return NextResponse.json(
        { error: "Verify your age before asking to see adult photos." },
        { status: 403 },
      );
    }
    const existing = await prisma.consentRequest.findUnique({
      where: {
        requesterId_ownerId_scope: {
          requesterId: user.id,
          ownerId: otherUserId,
          scope,
        },
      },
    });
    if (
      existing?.status === MessageRequestStatus.DENIED &&
      existing.respondedAt &&
      Date.now() - existing.respondedAt.getTime() < DECLINE_COOLDOWN_MS
    ) {
      return NextResponse.json(
        { error: "They declined recently. Please respect their decision." },
        { status: 403 },
      );
    }
    await prisma.consentRequest.upsert({
      where: {
        requesterId_ownerId_scope: {
          requesterId: user.id,
          ownerId: otherUserId,
          scope,
        },
      },
      create: { requesterId: user.id, ownerId: otherUserId, scope },
      update: {
        status: MessageRequestStatus.PENDING,
        createdAt: new Date(),
        respondedAt: null,
      },
    });
    return NextResponse.json({
      ok: true,
      status: "requested",
      message: "Request sent. The photos stay hidden unless they say yes.",
    });
  }

  if (action === "grant") {
    const error = await grantError(user.id, otherUserId, scope);
    if (error) return NextResponse.json({ error }, { status: 403 });
    const g = await grant(user.id, otherUserId, scope);
    return NextResponse.json({ grant: g });
  }

  if (action === "deny") {
    await prisma.consentRequest.updateMany({
      where: {
        requesterId: otherUserId,
        ownerId: user.id,
        scope,
        status: MessageRequestStatus.PENDING,
      },
      data: { status: MessageRequestStatus.DENIED, respondedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
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

async function grantError(
  ownerId: string,
  viewerId: string,
  scope: ConsentScope,
): Promise<string | null> {
  if (await isBlockedEitherWay(ownerId, viewerId)) {
    return "Cannot interact with this user";
  }
  if (scope === ConsentScope.ADULT_ALBUM) {
    if (!(await isVerifiedAdult(ownerId))) {
      return "Verify your age before sharing adult photos.";
    }
    if (!(await isVerifiedAdult(viewerId))) {
      return "They need to verify their age before they can see adult photos.";
    }
  }
  return null;
}

function grant(granterId: string, viewerId: string, scope: ConsentScope) {
  return prisma.consentGrant.upsert({
    where: { granterId_viewerId_scope: { granterId, viewerId, scope } },
    create: { granterId, viewerId, scope },
    update: { revokedAt: null, createdAt: new Date() },
  });
}
