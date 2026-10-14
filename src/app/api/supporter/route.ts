import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isAppRequest } from "@/lib/content-policy";
import { SUPPORTER_PERKS, supporterStatus } from "@/lib/supporter";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const status = await supporterStatus(user.id);
  return NextResponse.json({
    active: status.active,
    until: status.until,
    showBadge: status.showBadge,
    perks: SUPPORTER_PERKS,
    inApp: await isAppRequest(),
  });
}

const schema = z.object({ showBadge: z.boolean() });

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid setting" }, { status: 400 });
  }
  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, showBadge: parsed.data.showBadge },
    update: { showBadge: parsed.data.showBadge },
  });
  return NextResponse.json({ ok: true });
}
