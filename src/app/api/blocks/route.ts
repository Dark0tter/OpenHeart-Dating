import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { blockUser } from "@/lib/safety";

const schema = z.object({
  userId: z.string().min(1),
});

/** People you've blocked, newest first. */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const blocks = await prisma.block.findMany({
    where: { blockerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      createdAt: true,
      blocked: {
        select: { id: true, profile: { select: { displayName: true } } },
      },
    },
  });
  return NextResponse.json({
    blocked: blocks.map((b) => ({
      userId: b.blocked.id,
      displayName: b.blocked.profile?.displayName ?? "Former member",
      blockedAt: b.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await blockUser(user.id, parsed.data.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Block failed" },
      { status: 400 },
    );
  }
}

/** Unblocking only lifts the block; old likes, matches and chats don't come back. */
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  await prisma.block.deleteMany({
    where: { blockerId: user.id, blockedId: parsed.data.userId },
  });
  return NextResponse.json({ ok: true });
}
