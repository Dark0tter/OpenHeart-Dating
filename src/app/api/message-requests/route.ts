import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountStatus, MessageRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireMember, requireUser } from "@/lib/session";
import { isBlockedEitherWay } from "@/lib/safety";
import { acceptRequestTx } from "@/lib/message-requests";
import { allowedTiers } from "@/lib/content-policy";
import { textFilterFor } from "@/lib/moderation/app-text";
import {
  enforceSolicitationPolicy,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";

const schema = z.object({
  toUserId: z.string().min(1),
  body: z.string().trim().min(1).max(500),
});

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [incoming, outgoing] = await Promise.all([
    prisma.messageRequest.findMany({
      where: {
        toUserId: user.id,
        status: MessageRequestStatus.PENDING,
        fromUser: { accountStatus: AccountStatus.ACTIVE },
      },
      orderBy: { createdAt: "desc" },
      include: {
        fromUser: {
          select: { id: true, profile: { select: { displayName: true } } },
        },
      },
    }),
    prisma.messageRequest.findMany({
      where: { fromUserId: user.id, status: MessageRequestStatus.PENDING },
      orderBy: { createdAt: "desc" },
      include: {
        toUser: {
          select: { id: true, profile: { select: { displayName: true } } },
        },
      },
    }),
  ]);

  const filterText = textFilterFor(await allowedTiers(user));

  return NextResponse.json({
    incoming: incoming.map((r) => ({
      id: r.id,
      body: filterText(r.body),
      createdAt: r.createdAt,
      from: {
        id: r.fromUser.id,
        displayName: r.fromUser.profile?.displayName ?? "Member",
      },
    })),
    outgoing: outgoing.map((r) => ({
      id: r.id,
      body: filterText(r.body),
      createdAt: r.createdAt,
      to: {
        id: r.toUser.id,
        displayName: r.toUser.profile?.displayName ?? "Member",
      },
    })),
  });
}

export async function POST(req: Request) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json(
      { error: "Activate your profile to send private messages." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { toUserId, body } = parsed.data;

  if (toUserId === user.id) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
  }

  const recipient = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { accountStatus: true, profile: { select: { isActive: true } } },
  });
  if (
    !recipient ||
    recipient.accountStatus !== AccountStatus.ACTIVE ||
    !recipient.profile?.isActive ||
    (await isBlockedEitherWay(user.id, toUserId))
  ) {
    return NextResponse.json({ error: "Member not available" }, { status: 404 });
  }

  const solicitation = await enforceSolicitationPolicy({
    userId: user.id,
    context: "message_request",
    fields: { body },
  });
  if (solicitation.blocked) {
    return NextResponse.json(solicitationErrorBody(solicitation.labels), {
      status: 422,
    });
  }

  const existingMatch = await prisma.match.findFirst({
    where: {
      unmatchedAt: null,
      OR: [
        { userAId: user.id, userBId: toUserId },
        { userAId: toUserId, userBId: user.id },
      ],
    },
  });
  if (existingMatch) {
    return NextResponse.json({ status: "already_connected", matchId: existingMatch.id });
  }

  const theirs = await prisma.messageRequest.findFirst({
    where: {
      fromUserId: toUserId,
      toUserId: user.id,
      status: MessageRequestStatus.PENDING,
    },
  });
  if (theirs) {
    const match = await prisma.$transaction(async (tx) => {
      const m = await acceptRequestTx(tx, theirs);
      await tx.message.create({
        data: { matchId: m.id, senderId: user.id, body },
      });
      return m;
    });
    return NextResponse.json({ status: "connected", matchId: match.id });
  }

  const mine = await prisma.messageRequest.findFirst({
    where: {
      fromUserId: user.id,
      toUserId,
      status: MessageRequestStatus.PENDING,
    },
  });
  if (mine) {
    return NextResponse.json(
      { error: "You already have a request waiting with this member." },
      { status: 409 },
    );
  }

  const request = await prisma.messageRequest.create({
    data: { fromUserId: user.id, toUserId, body },
  });
  return NextResponse.json({ status: "sent", requestId: request.id });
}
