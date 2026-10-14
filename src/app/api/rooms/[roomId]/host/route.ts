import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStaff, requireMember } from "@/lib/session";
import { logAction } from "@/lib/moderation/staff-actions";
import {
  enforceSolicitationPolicy,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";

type Ctx = { params: Promise<{ roomId: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("delete_message"), messageId: z.string() }),
  z.object({
    action: z.literal("mute"),
    userId: z.string(),
    minutes: z
      .number()
      .int()
      .min(5)
      .max(7 * 24 * 60),
  }),
  z.object({ action: z.literal("unmute"), userId: z.string() }),
  z.object({
    action: z.literal("ban"),
    userId: z.string(),
    reason: z.string().max(300).optional(),
  }),
  z.object({ action: z.literal("unban"), userId: z.string() }),
  z.object({
    action: z.literal("settings"),
    rules: z.string().max(3000).nullable().optional(),
    pinnedNotice: z.string().max(300).nullable().optional(),
    slowModeSeconds: z.number().int().min(0).max(600).optional(),
  }),
  z.object({
    action: z.enum(["make_host", "remove_host"]),
    userId: z.string(),
  }),
]);

/** Host tools. Staff can use them in every room and are the only ones who appoint hosts. */
export async function POST(req: Request, ctx: Ctx) {
  const user = await requireMember();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { roomId } = await ctx.params;

  const membership = await prisma.roomMembership.findUnique({
    where: { roomId_userId: { roomId, userId: user.id } },
  });
  const staff = isStaff(user.role);
  if (!membership?.isHost && !staff) {
    return NextResponse.json(
      { error: "Only hosts can do that." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  if ("userId" in body) {
    if (body.userId === user.id) {
      return NextResponse.json(
        { error: "You can't do that to yourself." },
        { status: 400 },
      );
    }
    const target = await prisma.user.findUnique({
      where: { id: body.userId },
      select: {
        role: true,
        roomMemberships: { where: { roomId }, select: { isHost: true } },
      },
    });
    if (!target)
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!staff && (isStaff(target.role) || target.roomMemberships[0]?.isHost)) {
      return NextResponse.json(
        {
          error:
            "Hosts can't moderate other hosts or staff. Report them instead.",
        },
        { status: 403 },
      );
    }
  }

  switch (body.action) {
    case "delete_message": {
      const result = await prisma.roomMessage.updateMany({
        where: { id: body.messageId, roomId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (!result.count)
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 },
        );
      break;
    }
    case "mute":
      await prisma.roomMembership.updateMany({
        where: { roomId, userId: body.userId },
        data: { mutedUntil: new Date(Date.now() + body.minutes * 60_000) },
      });
      break;
    case "unmute":
      await prisma.roomMembership.updateMany({
        where: { roomId, userId: body.userId },
        data: { mutedUntil: null },
      });
      break;
    case "ban":
      await prisma.$transaction([
        prisma.roomBan.upsert({
          where: { roomId_userId: { roomId, userId: body.userId } },
          create: {
            roomId,
            userId: body.userId,
            bannedById: user.id,
            reason: body.reason,
          },
          update: { reason: body.reason, bannedById: user.id },
        }),
        prisma.roomMembership.deleteMany({
          where: { roomId, userId: body.userId },
        }),
      ]);
      break;
    case "unban":
      await prisma.roomBan.deleteMany({
        where: { roomId, userId: body.userId },
      });
      break;
    case "settings": {
      const solicitation = await enforceSolicitationPolicy({
        userId: user.id,
        context: `room-settings:${roomId}`,
        fields: { rules: body.rules, pinnedNotice: body.pinnedNotice },
      });
      if (solicitation.blocked) {
        return NextResponse.json(solicitationErrorBody(solicitation.labels), {
          status: 422,
        });
      }
      await prisma.chatRoom.update({
        where: { id: roomId },
        data: {
          rules: body.rules,
          pinnedNotice: body.pinnedNotice,
          slowModeSeconds: body.slowModeSeconds,
        },
      });
      break;
    }
    case "make_host":
    case "remove_host":
      if (!staff) {
        return NextResponse.json(
          { error: "Only staff can appoint hosts." },
          { status: 403 },
        );
      }
      await prisma.roomMembership.updateMany({
        where: { roomId, userId: body.userId },
        data: { isHost: body.action === "make_host" },
      });
      break;
  }

  await logAction({
    actorId: user.id,
    action: `room_${body.action}`,
    targetUserId: "userId" in body ? body.userId : null,
    note: `room:${roomId}${"reason" in body && body.reason ? ` — ${body.reason}` : ""}${
      body.action === "delete_message" ? ` message:${body.messageId}` : ""
    }`,
  });
  return NextResponse.json({ ok: true });
}
