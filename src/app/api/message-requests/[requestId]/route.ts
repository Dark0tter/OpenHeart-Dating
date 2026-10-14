import { NextResponse } from "next/server";
import { z } from "zod";
import { MessageRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isBlockedEitherWay } from "@/lib/safety";
import { acceptRequestTx } from "@/lib/message-requests";

const schema = z.object({
  action: z.enum(["accept", "deny"]),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ requestId: string }> },
) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { requestId } = await ctx.params;
  const request = await prisma.messageRequest.findFirst({
    where: {
      id: requestId,
      toUserId: user.id,
      status: MessageRequestStatus.PENDING,
    },
  });
  if (!request) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (parsed.data.action === "deny") {
    await prisma.messageRequest.update({
      where: { id: request.id },
      data: { status: MessageRequestStatus.DENIED, resolvedAt: new Date() },
    });
    return NextResponse.json({ status: "denied" });
  }

  if (await isBlockedEitherWay(user.id, request.fromUserId)) {
    return NextResponse.json(
      { error: "Member not available" },
      { status: 404 },
    );
  }

  const match = await prisma.$transaction((tx) => acceptRequestTx(tx, request));
  return NextResponse.json({ status: "connected", matchId: match.id });
}
