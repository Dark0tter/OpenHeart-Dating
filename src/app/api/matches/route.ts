import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ageFromDob } from "@/lib/utils";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matches = await prisma.match.findMany({
    where: {
      unmatchedAt: null,
      OR: [{ userAId: user.id }, { userBId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      userA: {
        include: {
          profile: {
            include: {
              photos: {
                where: { visibility: "PUBLIC" },
                take: 1,
                orderBy: [{ isPrimary: "desc" }],
              },
            },
          },
        },
      },
      userB: {
        include: {
          profile: {
            include: {
              photos: {
                where: { visibility: "PUBLIC" },
                take: 1,
                orderBy: [{ isPrimary: "desc" }],
              },
            },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return NextResponse.json({
    matches: matches.map((m) => {
      const other = m.userAId === user.id ? m.userB : m.userA;
      return {
        id: m.id,
        createdAt: m.createdAt,
        lastMessage: m.messages[0] ?? null,
        otherUser: {
          id: other.id,
          displayName: other.profile?.displayName ?? "Member",
          age: ageFromDob(other.dateOfBirth),
          photo: other.profile?.photos[0]?.url ?? null,
        },
      };
    }),
  });
}
