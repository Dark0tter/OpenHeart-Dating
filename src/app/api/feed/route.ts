import { NextResponse } from "next/server";
import { AccountStatus, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { blockedUserIds } from "@/lib/safety";
import { incognitoUserIdsVisibleTo } from "@/lib/discovery";

const PAGE_SIZE = 20;

/** Posts from people you follow or liked, plus your own, newest first. */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cursor = new URL(req.url).searchParams.get("cursor");

  const [follows, likes, blocked, incognitoAllowed] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    }),
    prisma.like.findMany({
      where: { fromUserId: user.id },
      select: { toUserId: true },
    }),
    blockedUserIds(user.id),
    incognitoUserIdsVisibleTo(user.id),
  ]);
  const blockedSet = new Set(blocked);
  const authorIds = [
    ...new Set([
      user.id,
      ...follows.map((f) => f.followingId),
      ...likes.map((l) => l.toUserId),
    ]),
  ].filter((id) => !blockedSet.has(id));

  const posts = await prisma.post.findMany({
    where: {
      authorId: { in: authorIds },
      deletedAt: null,
      author: {
        accountStatus: AccountStatus.ACTIVE,
        profile: { isActive: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      author: {
        select: {
          id: true,
          profile: { select: { displayName: true, visibility: true } },
        },
      },
    },
  });

  const hasMore = posts.length > PAGE_SIZE;
  const page = posts.slice(0, PAGE_SIZE);

  const visible = page.filter(
    (p) =>
      p.authorId === user.id ||
      p.author.profile?.visibility !== Visibility.INCOGNITO ||
      incognitoAllowed.has(p.authorId),
  );

  return NextResponse.json({
    posts: visible.map((p) => ({
      id: p.id,
      body: p.body,
      createdAt: p.createdAt,
      mine: p.authorId === user.id,
      author: {
        id: p.author.id,
        displayName: p.author.profile?.displayName ?? "Member",
      },
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
}
