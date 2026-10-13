import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { allowedTiers, isRestricted } from "@/lib/content-policy";
import { textFilterFor } from "@/lib/moderation/app-text";
import {
  enforceSolicitationPolicy,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";

const postSchema = z.object({
  body: z.string().min(1).max(4000).optional(),
  imageUrl: z.string().url().optional(),
  voiceUrl: z.string().url().optional(),
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

export async function GET(
  _req: Request,
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

  const messages = await prisma.message.findMany({
    where: { matchId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  // Mark others' messages as read
  await prisma.message.updateMany({
    where: {
      matchId,
      senderId: { not: user.id },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  const tiers = await allowedTiers(user);
  const filterText = textFilterFor(tiers);
  const hideMedia = isRestricted(tiers);

  return NextResponse.json({
    messages: messages.map((m) => ({
      ...m,
      body: m.body === null ? null : filterText(m.body),
      ...(hideMedia
        ? {
            imageUrl: null,
            voiceUrl: null,
            mediaHidden: Boolean(m.imageUrl || m.voiceUrl),
          }
        : {}),
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
  if (
    !parsed.success ||
    (!parsed.data.body && !parsed.data.imageUrl && !parsed.data.voiceUrl)
  ) {
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

  const message = await prisma.message.create({
    data: {
      matchId,
      senderId: user.id,
      body: parsed.data.body,
      imageUrl: parsed.data.imageUrl,
      voiceUrl: parsed.data.voiceUrl,
    },
  });

  return NextResponse.json({ message });
}
