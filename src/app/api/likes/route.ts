import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/session";
import { sendLike } from "@/lib/matching";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import { AccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/safety";
import { photoSrc, primaryPhotoWhere } from "@/lib/photos";
import { ageFromDob, orderedPair } from "@/lib/utils";

const schema = z.object({
  toUserId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await limitFor("likesPerUser", user.id);
  if (!limited.ok) {
    return tooManyRequests(limited, "You've reached today's like limit.");
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const result = await sendLike(user.id, parsed.data.toUserId);
    if (result.newMatch && result.match) {
      const link = `/messages/${result.match.id}`;
      await notify(parsed.data.toUserId, {
        type: "match",
        title: `You matched with ${user.profile?.displayName ?? "someone"}!`,
        body: "Say hi — messaging is free.",
        link,
        email: true,
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Like failed" },
      { status: 400 },
    );
  }
}

const personSelect = {
  id: true,
  dateOfBirth: true,
  profile: {
    select: {
      displayName: true,
      photos: {
        where: primaryPhotoWhere(),
        orderBy: [
          { isPrimary: "desc" as const },
          { sortOrder: "asc" as const },
        ],
        take: 1,
        select: { id: true },
      },
    },
  },
};

const visiblePerson = {
  accountStatus: AccountStatus.ACTIVE,
  profile: { isActive: true },
};

/** Free for everyone: who liked you, and who you've liked, minus matches. */
export async function GET() {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const blocked = await blockedUserIds(user.id);
  const [incoming, outgoing] = await Promise.all([
    prisma.like.findMany({
      where: {
        toUserId: user.id,
        fromUserId: { notIn: blocked },
        fromUser: visiblePerson,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { createdAt: true, fromUser: { select: personSelect } },
    }),
    prisma.like.findMany({
      where: {
        fromUserId: user.id,
        toUserId: { notIn: blocked },
        toUser: visiblePerson,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { createdAt: true, toUser: { select: personSelect } },
    }),
  ]);

  const likedIds = new Set(outgoing.map((l) => l.toUser.id));
  const likedMeIds = new Set(incoming.map((l) => l.fromUser.id));
  const card = (p: (typeof incoming)[number]["fromUser"], likedAt: Date) => ({
    userId: p.id,
    displayName: p.profile?.displayName ?? "Member",
    age: ageFromDob(p.dateOfBirth),
    photo: p.profile?.photos[0]
      ? photoSrc(p.profile.photos[0].id, "thumb")
      : null,
    likedAt,
  });

  return NextResponse.json({
    likedYou: incoming
      .filter((l) => !likedIds.has(l.fromUser.id))
      .map((l) => card(l.fromUser, l.createdAt)),
    youLiked: outgoing
      .filter((l) => !likedMeIds.has(l.toUser.id))
      .map((l) => card(l.toUser, l.createdAt)),
  });
}

/** Takes back a like that hasn't turned into a match (use Unmatch for those). */
export async function DELETE(req: Request) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const [a, b] = orderedPair(user.id, parsed.data.toUserId);
  const match = await prisma.match.findFirst({
    where: { userAId: a, userBId: b, unmatchedAt: null },
    select: { id: true },
  });
  if (match) {
    return NextResponse.json(
      { error: "You've matched. Use Unmatch in the chat instead." },
      { status: 409 },
    );
  }
  await prisma.like.deleteMany({
    where: { fromUserId: user.id, toUserId: parsed.data.toUserId },
  });
  return NextResponse.json({ ok: true });
}
