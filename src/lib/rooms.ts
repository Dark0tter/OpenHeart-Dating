import {
  AccountStatus,
  KinkInterestLevel,
  RoomKind,
  Visibility,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { blockedUserIds } from "@/lib/safety";
import { incognitoUserIdsVisibleTo } from "@/lib/discovery";

const ONLINE_WINDOW_MS = 90_000;
const PRESENCE_WRITE_INTERVAL_MS = 30_000;

/** Called on each room poll; writes at most every 30s per member. */
export async function touchRoomPresence(
  roomId: string,
  userId: string,
  lastSeenAt: Date | null,
) {
  const now = Date.now();
  if (lastSeenAt && now - lastSeenAt.getTime() < PRESENCE_WRITE_INTERVAL_MS) {
    return;
  }
  await prisma.$transaction([
    prisma.roomMembership.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastSeenAt: new Date(now) },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date(now) },
    }),
  ]);
}

export async function roomOnlineMembers(roomId: string, viewerUserId: string) {
  const [blocked, incognitoAllowed] = await Promise.all([
    blockedUserIds(viewerUserId),
    incognitoUserIdsVisibleTo(viewerUserId),
  ]);

  const rows = await prisma.roomMembership.findMany({
    where: {
      roomId,
      userId: { not: viewerUserId, notIn: blocked },
      lastSeenAt: { gt: new Date(Date.now() - ONLINE_WINDOW_MS) },
      user: {
        showOnline: true,
        accountStatus: AccountStatus.ACTIVE,
        profile: { isActive: true },
      },
    },
    orderBy: { lastSeenAt: "desc" },
    take: 100,
    select: {
      user: {
        select: {
          id: true,
          profile: { select: { displayName: true, visibility: true } },
        },
      },
    },
  });

  return rows
    .filter(
      (r) =>
        r.user.profile?.visibility !== Visibility.INCOGNITO ||
        incognitoAllowed.has(r.user.id),
    )
    .map((r) => ({
      id: r.user.id,
      displayName: r.user.profile?.displayName ?? "Member",
    }));
}

const POSITIVE_LEVELS: KinkInterestLevel[] = [
  "FAVORITE",
  "INTERESTED",
  "CURIOUS",
];

/** Rooms that match what the member listed on their profile (plus general rooms). */
export async function interestRoomIds(userId: string): Promise<Set<string>> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      kinks: {
        where: { level: { in: POSITIVE_LEVELS } },
        select: { kink: { select: { categoryId: true } } },
      },
      goalTags: { select: { tagId: true } },
    },
  });
  if (!profile) return new Set();

  const rooms = await prisma.chatRoom.findMany({
    where: {
      isActive: true,
      OR: [
        { kind: RoomKind.GENERAL },
        { kinkCategoryId: { in: profile.kinks.map((k) => k.kink.categoryId) } },
        { goalTagId: { in: profile.goalTags.map((g) => g.tagId) } },
      ],
    },
    select: { id: true },
  });
  return new Set(rooms.map((r) => r.id));
}

/**
 * Invites the member to every interest room they haven't joined or been invited to.
 * Existing invites (including declined ones) are left alone, so nothing is re-sent.
 */
export async function syncRoomInvites(userId: string): Promise<number> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { isActive: true },
  });
  if (!profile?.isActive) return 0;

  const [roomIds, memberships] = await Promise.all([
    interestRoomIds(userId),
    prisma.roomMembership.findMany({
      where: { userId },
      select: { roomId: true },
    }),
  ]);
  const joined = new Set(memberships.map((m) => m.roomId));
  const toInvite = [...roomIds].filter((id) => !joined.has(id));
  if (toInvite.length === 0) return 0;

  const result = await prisma.roomInvite.createMany({
    data: toInvite.map((roomId) => ({ roomId, userId })),
    skipDuplicates: true,
  });
  return result.count;
}
