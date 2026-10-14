import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { allowedTiers } from "@/lib/content-policy";
import { textFilterFor } from "@/lib/moderation/app-text";
import {
  enforceSolicitationPolicy,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";
import { checkForScam } from "@/lib/moderation/scam";
import { publish } from "@/lib/realtime";
import { notify } from "@/lib/notify";

// Text only: photos are shared through private album access, which is
// moderated and consent-based, never as arbitrary links.
const postSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

async function getAuthorizedMatch(matchId: string, userId: string) {
  return prisma.match.findFirst({
    where: {
      id: matchId,
      unmatchedAt: null,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
  });
}

const PAGE = 100;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ matchId: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId } = await ctx.params;
  const match = await getAuthorizedMatch(matchId, user.id);
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const otherId = match.userAId === user.id ? match.userBId : match.userAId;
  const beforeParam = new URL(req.url).searchParams.get("before");
  const before = beforeParam ? new Date(beforeParam) : null;
  const [latest, other] = await Promise.all([
    prisma.message.findMany({
      where: {
        matchId,
        ...(before && !Number.isNaN(before.getTime())
          ? { createdAt: { lt: before } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
    }),
    prisma.user.findUnique({
      where: { id: otherId },
      select: {
        readReceipts: true,
        profile: { select: { displayName: true } },
      },
    }),
  ]);
  const hasMore = latest.length > PAGE;
  const messages = latest.slice(0, PAGE).reverse();

  const marked = await prisma.message.updateMany({
    where: { matchId, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });
  const cleared = await prisma.notification.updateMany({
    where: {
      userId: user.id,
      type: "message",
      link: `/messages/${matchId}`,
      readAt: null,
    },
    data: { readAt: new Date() },
  });
  if (marked.count > 0 && user.readReceipts) {
    await publish(otherId, { type: "read", matchId });
  }
  if (cleared.count > 0) await publish(user.id, { type: "notification" });

  const tiers = await allowedTiers(user);
  const filterText = textFilterFor(tiers);
  // Read receipts are mutual: both people must have them on.
  const showReceipts = user.readReceipts && Boolean(other?.readReceipts);

  return NextResponse.json({
    me: user.id,
    hasMore,
    other: {
      userId: otherId,
      displayName: other?.profile?.displayName ?? "Member",
    },
    messages: messages.map((m) => ({
      ...m,
      readAt: m.senderId === user.id && !showReceipts ? null : m.readAt,
      // Only the recipient is warned; senders aren't tipped off.
      safetyFlag: m.senderId === user.id ? null : m.safetyFlag,
      body: m.body === null ? null : filterText(m.body),
    })),
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ matchId: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { matchId } = await ctx.params;
  const match = await getAuthorizedMatch(matchId, user.id);
  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const limited = await limitFor("messagesPerUser", user.id);
  if (!limited.ok) {
    return tooManyRequests(limited, "You're sending messages too quickly.");
  }

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const solicitation = await enforceSolicitationPolicy({
    userId: user.id,
    context: `message:${matchId}`,
    fields: { body: parsed.data.body },
  });
  if (solicitation.blocked) {
    return NextResponse.json(solicitationErrorBody(solicitation.labels), {
      status: 422,
    });
  }

  const safetyFlag = await checkForScam({
    senderId: user.id,
    senderCreatedAt: user.createdAt,
    matchId,
    text: parsed.data.body,
  });

  const message = await prisma.message.create({
    data: {
      matchId,
      senderId: user.id,
      body: parsed.data.body,
      safetyFlag,
    },
  });

  const otherId = match.userAId === user.id ? match.userBId : match.userAId;
  await publish(otherId, { type: "message", matchId });
  await notify(otherId, {
    type: "message",
    title: `New message from ${user.profile?.displayName ?? "a match"}`,
    link: `/messages/${matchId}`,
    email: true,
  });

  return NextResponse.json({ message });
}
