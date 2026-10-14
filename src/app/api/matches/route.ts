import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ageFromDob } from "@/lib/utils";
import { photoSrc, primaryPhotoWhere } from "@/lib/photos";
import { allowedTiers } from "@/lib/content-policy";
import { textFilterFor } from "@/lib/moderation/app-text";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const otherUser = {
    include: {
      profile: {
        include: {
          photos: {
            where: primaryPhotoWhere(),
            take: 1,
            orderBy: [{ isPrimary: "desc" as const }],
          },
        },
      },
    },
  };

  const filterText = textFilterFor(await allowedTiers(user));
  const matches = await prisma.match.findMany({
    where: {
      unmatchedAt: null,
      OR: [{ userAId: user.id }, { userBId: user.id }],
      userA: { accountStatus: "ACTIVE" },
      userB: { accountStatus: "ACTIVE" },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      userA: otherUser,
      userB: otherUser,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const lastActivity = (m: (typeof matches)[number]) =>
    (m.messages[0]?.createdAt ?? m.createdAt).getTime();
  matches.sort((a, b) => lastActivity(b) - lastActivity(a));

  return NextResponse.json({
    matches: matches.map((m) => {
      const other = m.userAId === user.id ? m.userB : m.userA;
      const photo = other.profile?.photos[0];
      const last = m.messages[0];
      return {
        id: m.id,
        createdAt: m.createdAt,
        unread: Boolean(last && last.senderId !== user.id && !last.readAt),
        lastMessage: m.messages[0]
          ? {
              ...m.messages[0],
              body: m.messages[0].body && filterText(m.messages[0].body),
              safetyFlag: undefined,
            }
          : null,
        otherUser: {
          id: other.id,
          displayName: other.profile?.displayName ?? "Member",
          age: ageFromDob(other.dateOfBirth),
          photo: photo ? photoSrc(photo.id, "thumb") : null,
        },
      };
    }),
  });
}
