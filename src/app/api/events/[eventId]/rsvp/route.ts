import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { allowedTiers } from "@/lib/content-policy";
import { isBlockedEitherWay } from "@/lib/safety";
import { notify } from "@/lib/notify";

type Ctx = { params: Promise<{ eventId: string }> };

const schema = z.object({ status: z.enum(["going", "interested"]) });

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json(
      { error: "Activate and verify your profile to RSVP." },
      { status: 403 },
    );
  }
  const { eventId } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid RSVP" }, { status: 400 });

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (
    !event ||
    event.cancelledAt ||
    !(await allowedTiers(user)).includes(event.tier) ||
    (await isBlockedEitherWay(user.id, event.hostId))
  ) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.hostId === user.id) {
    return NextResponse.json(
      { error: "You're hosting this one." },
      { status: 400 },
    );
  }

  const status = parsed.data.status;
  if (status === "going" && event.capacity != null) {
    const going = await prisma.eventRsvp.count({
      where: { eventId, status: "going", userId: { not: user.id } },
    });
    if (going >= event.capacity) {
      return NextResponse.json(
        { error: "This event is full." },
        { status: 409 },
      );
    }
  }

  const before = await prisma.eventRsvp.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
  });
  await prisma.eventRsvp.upsert({
    where: { eventId_userId: { eventId, userId: user.id } },
    create: { eventId, userId: user.id, status },
    update: { status },
  });
  if (status === "going" && before?.status !== "going") {
    await notify(event.hostId, {
      type: "event",
      title: `${user.profile.displayName} is going to ${event.title}`,
      link: `/events/${eventId}`,
    });
  }
  return NextResponse.json({ ok: true, status });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireMember();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { eventId } = await ctx.params;
  await prisma.eventRsvp.deleteMany({ where: { eventId, userId: user.id } });
  return NextResponse.json({ ok: true });
}
