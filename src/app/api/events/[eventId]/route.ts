import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStaff, requireMember, requireUser } from "@/lib/session";
import { allowedTiers } from "@/lib/content-policy";
import { textFilterFor } from "@/lib/moderation/app-text";
import {
  enforceSolicitationPolicy,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";
import { isBlockedEitherWay } from "@/lib/safety";
import { eventView } from "@/lib/events";
import { notify } from "@/lib/notify";
import { logAction } from "@/lib/moderation/staff-actions";

type Ctx = { params: Promise<{ eventId: string }> };

async function load(eventId: string, viewerId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      host: {
        select: {
          id: true,
          accountStatus: true,
          profile: { select: { displayName: true } },
        },
      },
      _count: { select: { rsvps: true } },
      rsvps: {
        where: { userId: viewerId },
        select: { userId: true, status: true },
      },
    },
  });
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireMember();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { eventId } = await ctx.params;
  const event = await load(eventId, user.id);
  const tiers = await allowedTiers(user);
  if (
    !event ||
    event.host.accountStatus !== "ACTIVE" ||
    !tiers.includes(event.tier) ||
    (await isBlockedEitherWay(user.id, event.hostId))
  ) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const going = await prisma.eventRsvp.count({
    where: { eventId, status: "going" },
  });
  const view = eventView(
    event,
    {
      id: user.id,
      latitude: user.profile?.latitude,
      longitude: user.profile?.longitude,
    },
    textFilterFor(tiers),
    going,
  );

  // Only the host sees who's coming.
  const attendees = view.isHost
    ? (
        await prisma.eventRsvp.findMany({
          where: { eventId },
          orderBy: { createdAt: "asc" },
          select: {
            status: true,
            user: {
              select: { id: true, profile: { select: { displayName: true } } },
            },
          },
        })
      ).map((r) => ({
        userId: r.user.id,
        displayName: r.user.profile?.displayName ?? "Member",
        status: r.status,
      }))
    : null;

  return NextResponse.json({
    event: view,
    attendees,
    canModerate: isStaff(user.role),
  });
}

const patchSchema = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  venueName: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  onlineUrl: z.string().trim().url().max(500).nullable().optional(),
  capacity: z.number().int().min(1).max(10000).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

const MAX_DAYS_AHEAD = 365;

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { eventId } = await ctx.params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.hostId !== user.id || event.cancelledAt) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the event details." },
      { status: 400 },
    );
  }
  const solicitation = await enforceSolicitationPolicy({
    userId: user.id,
    context: `event:${eventId}`,
    fields: { title: parsed.data.title, description: parsed.data.description },
  });
  if (solicitation.blocked) {
    return NextResponse.json(solicitationErrorBody(solicitation.labels), {
      status: 422,
    });
  }
  const data = parsed.data;
  const startsAt = data.startsAt ?? event.startsAt;
  const endsAt = data.endsAt === undefined ? event.endsAt : data.endsAt;
  if (endsAt && endsAt <= startsAt) {
    return NextResponse.json(
      { error: "The end time must be after the start." },
      { status: 400 },
    );
  }
  const now = Date.now();
  if (
    data.startsAt &&
    data.startsAt.getTime() !== event.startsAt.getTime() &&
    (data.startsAt.getTime() < now - 3600_000 ||
      data.startsAt.getTime() > now + MAX_DAYS_AHEAD * 86400_000)
  ) {
    return NextResponse.json(
      { error: "Pick a start time within the next year." },
      { status: 400 },
    );
  }
  if (data.capacity != null) {
    const going = await prisma.eventRsvp.count({
      where: { eventId, status: "going" },
    });
    if (data.capacity < going) {
      return NextResponse.json(
        {
          error: `${going} people are already going. Capacity can't be lower.`,
        },
        { status: 400 },
      );
    }
  }

  await prisma.event.update({ where: { id: eventId }, data });

  const moved =
    startsAt.getTime() !== event.startsAt.getTime() ||
    (endsAt?.getTime() ?? null) !== (event.endsAt?.getTime() ?? null) ||
    (data.venueName !== undefined && data.venueName !== event.venueName) ||
    (data.address !== undefined && data.address !== event.address) ||
    (data.onlineUrl !== undefined && data.onlineUrl !== event.onlineUrl);
  if (moved) {
    const rsvps = await prisma.eventRsvp.findMany({
      where: { eventId },
      select: { userId: true },
    });
    for (const r of rsvps) {
      await notify(r.userId, {
        type: "event",
        title: `"${data.title ?? event.title}" has new time or place details`,
        link: `/events/${eventId}`,
        email: true,
      });
    }
  }
  return NextResponse.json({ ok: true });
}

/** Cancel (host or staff). Everyone who RSVP'd is told. */
export async function DELETE(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { eventId } = await ctx.params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { rsvps: { select: { userId: true } } },
  });
  const staff = isStaff(user.role);
  if (!event || (event.hostId !== user.id && !staff) || event.cancelledAt) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  await prisma.event.update({
    where: { id: eventId },
    data: { cancelledAt: new Date() },
  });
  if (event.hostId !== user.id) {
    const reason = (
      (await req.json().catch(() => null)) as { reason?: string } | null
    )?.reason;
    await logAction({
      actorId: user.id,
      action: "event_cancel",
      targetUserId: event.hostId,
      note: `event:${eventId}${reason ? ` — ${reason}` : ""}`,
    });
  }
  for (const r of event.rsvps) {
    if (r.userId === user.id) continue;
    await notify(r.userId, {
      type: "event",
      title: `Cancelled: ${event.title}`,
      body: "An event you RSVP'd to was cancelled.",
      link: `/events/${eventId}`,
      email: true,
    });
  }
  return NextResponse.json({ ok: true });
}
