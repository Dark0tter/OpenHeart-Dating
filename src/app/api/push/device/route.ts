import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const MAX_DEVICES = 10;

const schema = z.object({
  platform: z.enum(["ios", "android"]),
  token: z
    .string()
    .min(20)
    .max(4096)
    .regex(/^[\w:.-]+$/),
});

/** Called by the iPhone/Android app after the member allows notifications. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid device" }, { status: 400 });
  }
  const { platform, token } = parsed.data;
  await prisma.deviceToken.upsert({
    where: { token },
    create: { userId: user.id, platform, token },
    update: { userId: user.id, platform, lastSeenAt: new Date() },
  });

  const extra = await prisma.deviceToken.findMany({
    where: { userId: user.id },
    orderBy: { lastSeenAt: "desc" },
    skip: MAX_DEVICES,
    select: { id: true },
  });
  if (extra.length) {
    await prisma.deviceToken.deleteMany({
      where: { id: { in: extra.map((e) => e.id) } },
    });
  }
  return NextResponse.json({ ok: true });
}

/** Turns notifications off for one app install (or all of them). */
export async function DELETE(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    token?: string;
  } | null;
  await prisma.deviceToken.deleteMany({
    where: {
      userId: user.id,
      ...(body?.token ? { token: body.token } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
