"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/session";
import { logAction } from "@/lib/moderation/staff-actions";
import { endSupporter, grantSupporter } from "@/lib/supporter";

export async function supporterAction(fd: FormData) {
  const staff = await requireStaff("ADMIN");
  if (!staff) throw new Error("Only admins can change supporter status");
  const userId = String(fd.get("userId") ?? "");
  const action = String(fd.get("action") ?? "");
  const note =
    String(fd.get("note") ?? "")
      .trim()
      .slice(0, 500) || null;

  if (action === "grant") {
    const months = Math.min(24, Math.max(1, Number(fd.get("months")) || 1));
    const sub = await grantSupporter({ userId, months, note });
    await logAction({
      actorId: staff.id,
      action: "supporter_grant",
      targetUserId: userId,
      note: `${months} month(s) until ${sub.currentPeriodEnd?.toISOString().slice(0, 10)}${note ? ` — ${note}` : ""}`,
    });
  } else if (action === "end") {
    await endSupporter(userId);
    await logAction({
      actorId: staff.id,
      action: "supporter_end",
      targetUserId: userId,
      note,
    });
  }
  revalidatePath(`/mod/users/${userId}`);
}
