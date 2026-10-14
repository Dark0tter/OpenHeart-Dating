import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ageFromDob } from "@/lib/utils";
import { photoSrc, primaryPhotoWhere } from "@/lib/photos";

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

  const matches = await prisma.match.findMany({
    where: {
      unmatchedAt: null,
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      userA: otherUser,
      userB: otherUser,
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    matches: matches.map((m) => {
      const other = m.userAId === user.id ? m.userB : m.userA;
      const photo = other.profile?.photos[0];
      return {
        id: m.id,
        createdAt: m.createdAt,
        lastMessage: m.messages[0] ?? null,
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
