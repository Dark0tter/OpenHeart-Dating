import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMember, requireUser } from "@/lib/session";
import { assertProfileViewable } from "@/lib/discovery";

const schema = z.object({
  userId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json(
      { error: "Activate your profile to follow members." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success || parsed.data.userId === user.id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const visible = await assertProfileViewable({
    profileUserId: parsed.data.userId,
    viewerUserId: user.id,
  });
  if (!visible) {
    return NextResponse.json({ error: "Member not available" }, { status: 404 });
  }

  await prisma.follow.upsert({
    where: {
      followerId_followingId: {
        followerId: user.id,
        followingId: parsed.data.userId,
      },
    },
    create: { followerId: user.id, followingId: parsed.data.userId },
    update: {},
  });
  return NextResponse.json({ following: true });
}

export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  await prisma.follow.deleteMany({
    where: { followerId: user.id, followingId: userId },
  });
  return NextResponse.json({ following: false });
}
