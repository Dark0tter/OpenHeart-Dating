import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function GET(req: Request) {
  const user = await requireUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const unread = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  if (new URL(req.url).searchParams.get("count")) {
    return NextResponse.json({ unread });
  }
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      link: true,
      readAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ unread, notifications });
}

const patchSchema = z.object({
  ids: z.array(z.string()).max(100).optional(),
  all: z.literal(true).optional(),
});

/** Mark some or all notifications as read. */
export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.ids && !parsed.data.all)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  await prisma.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
      ...(parsed.data.all ? {} : { id: { in: parsed.data.ids } }),
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
