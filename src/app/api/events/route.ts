import { NextResponse } from "next/server";
import { z } from "zod";
import { ContentTier, EventKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import { allowedTiers, isRestricted } from "@/lib/content-policy";
import { textFilterFor } from "@/lib/moderation/app-text";
import {
  enforceSolicitationPolicy,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { blockedUserIds } from "@/lib/safety";
import { eventView, upcomingWhere } from "@/lib/events";
import { coarse, geocodeCity } from "@/lib/geocode";

const MAX_DAYS_AHEAD = 365;

export async function GET(req: Request) {
  const user = await requireMember();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const scope = params.get("scope") ?? "upcoming"; // upcoming | nearby | online | mine
  const tiers = await allowedTiers(user);
  const filterText = textFilterFor(tiers);
  const blocked = await blockedUserIds(user.id);

  const events = await prisma.event.findMany({
    where: {
      ...upcomingWhere(),
      tier: { in: tiers },
      hostId: { notIn: blocked },
      host: { accountStatus: "ACTIVE" },
      ...(scope === "online" ? { kind: EventKind.ONLINE } : {}),
      ...(scope === "mine"
        ? {
            OR: [{ hostId: user.id }, { rsvps: { some: { userId: user.id } } }],
          }
        : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 200,
    include: {
      host: {
        select: { id: true, profile: { select: { displayName: true } } },
      },
      _count: { select: { rsvps: true } },
      rsvps: {
        where: { userId: user.id },
        select: { userId: true, status: true },
      },
    },
  });

  const going = await prisma.eventRsvp.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((e) => e.id) }, status: "going" },
    _count: true,
  });
  const goingBy = new Map(going.map((g) => [g.eventId, g._count]));

  const viewer = {
    id: user.id,
    latitude: user.profile?.latitude,
    longitude: user.profile?.longitude,
  };
  let list = events.map((e) =>
    eventView(e, viewer, filterText, goingBy.get(e.id) ?? 0),
  );
  if (scope === "nearby") {
    const radius = user.profile?.radiusKm ?? 50;
    list = list.filter(
      (e) => e.kind !== "ONLINE" && e.km != null && e.km <= radius,
    );
  }

  return NextResponse.json({
    hasLocation: viewer.latitude != null,
    restricted: isRestricted(tiers),
    events: list.slice(0, 100),
  });
}

const createSchema = z
  .object({
    kind: z.nativeEnum(EventKind),
    tier: z.nativeEnum(ContentTier).default(ContentTier.STANDARD),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(5000),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullable().optional(),
    venueName: z.string().trim().max(120).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    onlineUrl: z.string().trim().url().max(500).nullable().optional(),
    city: z.string().trim().max(80).nullable().optional(),
    state: z.string().trim().max(80).nullable().optional(),
    country: z.string().trim().max(80).nullable().optional(),
    capacity: z.number().int().min(1).max(10000).nullable().optional(),
  })
  .refine((e) => !e.endsAt || e.endsAt > e.startsAt, {
    message: "The end time must be after the start.",
  })
  .refine((e) => e.kind === EventKind.ONLINE || Boolean(e.city), {
    message: "In-person events need a city.",
  });

export async function POST(req: Request) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json(
      { error: "Activate and verify your profile to host events." },
      { status: 403 },
    );
  }
  const limited = await limitFor("eventsPerUser", user.id);
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Please check the event details.",
      },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const now = Date.now();
  if (
    data.startsAt.getTime() < now - 3600_000 ||
    data.startsAt.getTime() > now + MAX_DAYS_AHEAD * 86400_000
  ) {
    return NextResponse.json(
      { error: "Pick a start time within the next year." },
      { status: 400 },
    );
  }
  if (!(await allowedTiers(user)).includes(data.tier)) {
    return NextResponse.json(
      { error: "Create adult events on the Kindred Kinks website." },
      { status: 403 },
    );
  }

  const solicitation = await enforceSolicitationPolicy({
    userId: user.id,
    context: "event",
    fields: {
      title: data.title,
      description: data.description,
      venueName: data.venueName,
    },
  });
  if (solicitation.blocked) {
    return NextResponse.json(solicitationErrorBody(solicitation.labels), {
      status: 422,
    });
  }

  const coords =
    data.kind === EventKind.ONLINE ? null : await geocodeCity(data);
  const event = await prisma.event.create({
    data: {
      ...data,
      hostId: user.id,
      latitude: coords ? coarse(coords.latitude) : null,
      longitude: coords ? coarse(coords.longitude) : null,
      rsvps: { create: { userId: user.id, status: "going" } },
    },
  });
  return NextResponse.json({ id: event.id });
}
