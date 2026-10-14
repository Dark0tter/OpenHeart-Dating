"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import {
  closeReport,
  closeTicket,
  escalateChildSafety,
  logAction,
  recordExternalRef,
  reinstateUser,
  reviewAppeal,
  reviewPhoto,
  reviewSelfie,
  setLegalHold,
  suspendUser,
  warnUser,
} from "@/lib/moderation/staff-actions";

async function staffOrThrow(minimum: "MODERATOR" | "ADMIN" = "MODERATOR") {
  const staff = await requireStaff(minimum);
  if (!staff) throw new Error("Not allowed");
  return staff;
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function reportAction(fd: FormData) {
  const staff = await staffOrThrow();
  const reportId = text(fd, "reportId");
  const action = text(fd, "action");
  const note = text(fd, "note");
  const report = await prisma.report.findUniqueOrThrow({
    where: { id: reportId },
  });
  const userId = report.reportedUserId;

  switch (action) {
    case "assign":
      await prisma.report.update({
        where: { id: reportId },
        data: { assigneeId: staff.id },
      });
      await logAction({
        actorId: staff.id,
        action: "report_assign",
        reportId,
        targetUserId: userId,
      });
      break;
    case "dismiss":
      await closeReport({
        actorId: staff.id,
        reportId,
        status: "dismissed",
        resolution: note || "No violation found",
      });
      break;
    case "resolve":
      await closeReport({
        actorId: staff.id,
        reportId,
        status: "resolved",
        resolution: note || "Handled",
      });
      break;
    case "warn":
      if (!note) throw new Error("Write the warning message");
      await warnUser({ actorId: staff.id, userId, message: note, reportId });
      await closeReport({
        actorId: staff.id,
        reportId,
        status: "resolved",
        resolution: `Warned: ${note}`,
      });
      break;
    case "suspend": {
      const days = Number(text(fd, "days")) || null;
      await suspendUser({
        actorId: staff.id,
        userId,
        reason: note || "Breaking our community guidelines",
        days,
        reportId,
      });
      await closeReport({
        actorId: staff.id,
        reportId,
        status: "resolved",
        resolution: `Suspended ${days ? `${days} days` : "indefinitely"}: ${note}`,
      });
      break;
    }
    case "escalate":
      await escalateChildSafety({ actorId: staff.id, reportId, note });
      break;
    case "external_ref":
      await staffOrThrow("ADMIN");
      if (!note) throw new Error("Enter the CyberTipline report number");
      await recordExternalRef({
        actorId: staff.id,
        reportId,
        externalRef: note,
      });
      break;
    case "hold_on":
    case "hold_off":
      await staffOrThrow("ADMIN");
      await setLegalHold({
        actorId: staff.id,
        reportId,
        hold: action === "hold_on",
      });
      break;
    default:
      throw new Error("Unknown action");
  }
  revalidatePath(`/mod/reports/${reportId}`);
  revalidatePath("/mod/reports");
}

export async function memberAction(fd: FormData) {
  const staff = await staffOrThrow();
  const userId = text(fd, "userId");
  const action = text(fd, "action");
  const note = text(fd, "note");

  if (action === "suspend") {
    const days = Number(text(fd, "days")) || null;
    await suspendUser({
      actorId: staff.id,
      userId,
      reason: note || "Breaking our community guidelines",
      days,
    });
  } else if (action === "reinstate") {
    await reinstateUser({ actorId: staff.id, userId, note });
  } else if (action === "warn") {
    if (!note) throw new Error("Write the warning message");
    await warnUser({ actorId: staff.id, userId, message: note });
  } else if (action === "revoke_photo_badge") {
    await prisma.user.update({
      where: { id: userId },
      data: { photoVerifiedAt: null },
    });
    await logAction({
      actorId: staff.id,
      action: "photo_badge_revoke",
      targetUserId: userId,
      note,
    });
  } else if (action === "set_role") {
    await staffOrThrow("ADMIN");
    const role = text(fd, "role") as UserRole;
    if (!Object.values(UserRole).includes(role)) throw new Error("Bad role");
    if (userId === staff.id) throw new Error("You can't change your own role");
    await prisma.user.update({ where: { id: userId }, data: { role } });
    await logAction({
      actorId: staff.id,
      action: `role_${role.toLowerCase()}`,
      targetUserId: userId,
    });
  } else {
    throw new Error("Unknown action");
  }
  revalidatePath(`/mod/users/${userId}`);
}

export async function photoAction(fd: FormData) {
  const staff = await staffOrThrow();
  await reviewPhoto({
    actorId: staff.id,
    photoId: text(fd, "photoId"),
    approve: text(fd, "decision") === "approve",
    reason: text(fd, "reason") || undefined,
    blockForever: fd.get("blockForever") === "on",
  });
  revalidatePath("/mod/photos");
}

export async function selfieAction(fd: FormData) {
  const staff = await staffOrThrow();
  await reviewSelfie({
    actorId: staff.id,
    selfieId: text(fd, "selfieId"),
    approve: text(fd, "decision") === "approve",
    note: text(fd, "note") || undefined,
  });
  revalidatePath("/mod/selfies");
}

/** The moderator who suspended someone can't decide their appeal (admins excepted). */
export async function appealAction(fd: FormData) {
  const staff = await staffOrThrow();
  const appealId = text(fd, "appealId");
  const appeal = await prisma.appeal.findUniqueOrThrow({
    where: { id: appealId },
  });
  if (staff.role !== UserRole.ADMIN) {
    const lastSuspension = await prisma.modAction.findFirst({
      where: { targetUserId: appeal.userId, action: { startsWith: "suspend" } },
      orderBy: { createdAt: "desc" },
    });
    if (lastSuspension?.actorId === staff.id) {
      throw new Error("A different moderator must review this appeal");
    }
  }
  await reviewAppeal({
    actorId: staff.id,
    appealId,
    approve: text(fd, "decision") === "approve",
    note: text(fd, "note") || "Reviewed by our safety team.",
  });
  revalidatePath("/mod/appeals");
}

export async function roomHostAction(fd: FormData) {
  const staff = await staffOrThrow();
  const roomId = text(fd, "roomId");
  const makeHost = text(fd, "action") === "make_host";
  const userId =
    text(fd, "userId") ||
    (
      await prisma.user.findUnique({
        where: { email: text(fd, "email").toLowerCase() },
        select: { id: true },
      })
    )?.id;
  if (!userId) throw new Error("No member with that email");
  const result = await prisma.roomMembership.updateMany({
    where: { roomId, userId },
    data: { isHost: makeHost },
  });
  if (!result.count) throw new Error("They need to join the room first");
  await logAction({
    actorId: staff.id,
    action: makeHost ? "room_make_host" : "room_remove_host",
    targetUserId: userId,
    note: `room:${roomId}`,
  });
  revalidatePath("/mod/rooms");
}

export async function ticketAction(fd: FormData) {
  const staff = await staffOrThrow();
  await closeTicket({
    actorId: staff.id,
    ticketId: text(fd, "ticketId"),
    reply: text(fd, "reply"),
  });
  revalidatePath("/mod/support");
}
