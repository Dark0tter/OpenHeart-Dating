import {
  ContentTier,
  EventKind,
  type Event,
  type Prisma,
} from "@prisma/client";
import { distanceKm } from "@/lib/utils";

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  MUNCH: "Munch (casual meetup in a public place)",
  SOCIAL: "Social or party",
  CLASS: "Class or workshop",
  ONLINE: "Online",
};

export const EVENT_TIER_LABELS: Record<ContentTier, string> = {
  STANDARD: "General — shown everywhere",
  ADULT_TEXT: "Adult themes — hidden in the apps unless members opt in",
  WEB_ONLY: "Website only",
};

/** Events stay listed until they end (or 4 hours after starting if no end time). */
export function upcomingWhere(now = new Date()): Prisma.EventWhereInput {
  return {
    cancelledAt: null,
    OR: [
      { endsAt: { gte: now } },
      {
        endsAt: null,
        startsAt: { gte: new Date(now.getTime() - 4 * 3600_000) },
      },
    ],
  };
}

type Viewer = {
  id: string;
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * What a viewer may see of an event. The address and online link are only for
 * the host and people going, so strangers can't turn up uninvited.
 */
export function eventView(
  e: Event & {
    host: { id: string; profile: { displayName: string } | null };
    _count: { rsvps: number };
    rsvps: { userId: string; status: string }[];
  },
  viewer: Viewer,
  filterText: (s: string) => string,
  goingCount: number,
) {
  const mine = e.rsvps.find((r) => r.userId === viewer.id)?.status ?? null;
  const isHost = e.hostId === viewer.id;
  const insider = isHost || mine === "going";
  const km =
    viewer.latitude != null &&
    viewer.longitude != null &&
    e.latitude != null &&
    e.longitude != null
      ? distanceKm(viewer.latitude, viewer.longitude, e.latitude, e.longitude)
      : null;

  return {
    id: e.id,
    kind: e.kind,
    tier: e.tier,
    title: filterText(e.title),
    description: filterText(e.description),
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    venueName: e.venueName,
    city: e.city,
    state: e.state,
    country: e.country,
    address: insider ? e.address : null,
    onlineUrl: insider ? e.onlineUrl : null,
    hasPrivateDetails: Boolean(e.address || e.onlineUrl),
    capacity: e.capacity,
    going: goingCount,
    interested: e._count.rsvps - goingCount,
    full: e.capacity != null && goingCount >= e.capacity,
    cancelled: Boolean(e.cancelledAt),
    km: km == null ? null : Math.round(km),
    roomId: e.roomId,
    host: {
      id: e.host.id,
      displayName: e.host.profile?.displayName ?? "Member",
    },
    isHost,
    yourRsvp: mine,
  };
}
