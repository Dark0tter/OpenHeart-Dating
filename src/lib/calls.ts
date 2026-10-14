import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/realtime";
import { notify } from "@/lib/notify";
import { orderedPair } from "@/lib/utils";

/** Unanswered calls stop ringing after this long. */
export const RING_MS = 45 * 1000;
/** Safety net for calls whose devices vanished without hanging up. */
export const MAX_CALL_MS = 4 * 60 * 60 * 1000;
export const MAX_SIGNALS_PER_CALL = 300;

export const LIVE_STATUSES = ["ringing", "active"];

export type CallCheck =
  { ok: true; otherId: string } | { ok: false; status: number; error: string };

/**
 * Matches can call each other once both have sent at least one message, and
 * only if the other person allows calls.
 */
export async function canCall(
  userId: string,
  matchId: string,
): Promise<CallCheck> {
  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      unmatchedAt: null,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
  });
  if (!match) return { ok: false, status: 404, error: "Not found" };
  const otherId = match.userAId === userId ? match.userBId : match.userAId;

  const [other, senders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: otherId },
      select: { accountStatus: true, allowCalls: true },
    }),
    prisma.message.groupBy({ by: ["senderId"], where: { matchId } }),
  ]);
  if (!other || other.accountStatus !== "ACTIVE") {
    return { ok: false, status: 404, error: "Not found" };
  }
  if (senders.length < 2) {
    return {
      ok: false,
      status: 403,
      error: "You can call once you've both sent a message.",
    };
  }
  if (!other.allowCalls) {
    return {
      ok: false,
      status: 403,
      error: "They've turned off calls. You can still message them.",
    };
  }
  return { ok: true, otherId };
}

export async function busy(userIds: string[], now = new Date()) {
  const call = await prisma.call.findFirst({
    where: {
      AND: [
        {
          OR: [{ callerId: { in: userIds } }, { calleeId: { in: userIds } }],
        },
        {
          OR: [
            { status: "active" },
            {
              status: "ringing",
              createdAt: { gt: new Date(now.getTime() - RING_MS) },
            },
          ],
        },
      ],
    },
    select: { id: true },
  });
  return Boolean(call);
}

/** Ends a call and tells both devices. */
export async function finishCall(
  callId: string,
  status: "ended" | "declined" | "missed",
  now = new Date(),
) {
  const updated = await prisma.call.updateMany({
    where: { id: callId, status: { in: LIVE_STATUSES } },
    data: { status, endedAt: now },
  });
  if (!updated.count) return false;
  const call = await prisma.call.findUniqueOrThrow({ where: { id: callId } });
  await prisma.callSignal.deleteMany({ where: { callId } });
  await Promise.all([
    publish(call.callerId, { type: "call", callId }),
    publish(call.calleeId, { type: "call", callId }),
  ]);
  if (status === "missed") {
    await notify(call.calleeId, {
      type: "call",
      title: "Missed call",
      body: "Someone you matched with tried to call you.",
      link: `/messages/${call.matchId}`,
    });
  }
  return true;
}

/** Used when people unmatch or block: any live call between them ends now. */
export async function endCallsBetween(a: string, b: string) {
  const [userAId, userBId] = orderedPair(a, b);
  const calls = await prisma.call.findMany({
    where: { match: { userAId, userBId }, status: { in: LIVE_STATUSES } },
    select: { id: true },
  });
  for (const c of calls) await finishCall(c.id, "ended");
}

/** Background clean-up: stop calls nobody answered or hung up. */
export async function expireCalls(now = new Date()) {
  const [ringing, stale] = await Promise.all([
    prisma.call.findMany({
      where: {
        status: "ringing",
        createdAt: { lte: new Date(now.getTime() - RING_MS) },
      },
      select: { id: true },
      take: 200,
    }),
    prisma.call.findMany({
      where: {
        status: "active",
        answeredAt: { lte: new Date(now.getTime() - MAX_CALL_MS) },
      },
      select: { id: true },
      take: 200,
    }),
  ]);
  for (const c of ringing) await finishCall(c.id, "missed", now);
  for (const c of stale) await finishCall(c.id, "ended", now);
  await prisma.callSignal.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) } },
  });
  return { missed: ringing.length, ended: stale.length };
}

/** STUN finds a direct route; TURN relays when a network blocks that. */
export function iceServers() {
  const servers: { urls: string[]; username?: string; credential?: string }[] =
    [
      {
        urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"],
      },
    ];
  const turn = (process.env.TURN_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter((u) => /^turns?:/.test(u));
  if (turn.length && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    servers.push({
      urls: turn,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }
  return servers;
}
