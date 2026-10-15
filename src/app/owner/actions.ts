"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { InquiryStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { resetStaffTwoStep, setStaffRole } from "@/lib/staff-roles";
import { notifyCity } from "@/lib/waitlist";
import {
  announcementSchema,
  createAnnouncement,
  endAnnouncement,
} from "@/lib/announcements";
import { logAction } from "@/lib/moderation/staff-actions";

export async function changeRole(fd: FormData) {
  const owner = await requireStaff("OWNER");
  if (!owner) redirect("/feed");

  const result = await setStaffRole({
    actor: owner,
    userId: String(fd.get("userId") ?? ""),
    role: String(fd.get("role") ?? "") as UserRole,
    reason: String(fd.get("reason") ?? ""),
  });
  revalidatePath("/owner/staff");
  back(result, String(fd.get("q") ?? ""));
}

export async function resetTwoStep(fd: FormData) {
  const owner = await requireStaff("OWNER");
  if (!owner) redirect("/feed");
  const result = await resetStaffTwoStep({
    actor: owner,
    userId: String(fd.get("userId") ?? ""),
    reason: String(fd.get("reason") ?? ""),
  });
  revalidatePath("/owner/staff");
  back(result, "");
}

function back(
  result: { ok: true; message: string } | { ok: false; error: string },
  q: string,
): never {
  const params = new URLSearchParams(
    result.ok ? { ok: result.message } : { error: result.error },
  );
  if (q) params.set("q", q);
  redirect(`/owner/staff?${params}`);
}

export async function updateInquiry(fd: FormData) {
  const owner = await requireStaff("OWNER");
  if (!owner) redirect("/feed");
  const status = String(fd.get("status") ?? "");
  if (!(status in InquiryStatus)) return;
  const notes = String(fd.get("staffNotes") ?? "")
    .trim()
    .slice(0, 2000);
  await prisma.sponsorInquiry.update({
    where: { id: String(fd.get("id") ?? "") },
    data: { status: status as InquiryStatus, staffNotes: notes || null },
  });
  revalidatePath("/owner/ads");
}

export async function emailWaitlist(fd: FormData) {
  const owner = await requireStaff("OWNER");
  if (!owner) redirect("/feed");
  const city = String(fd.get("city") ?? "").trim();
  const state = String(fd.get("state") ?? "").trim() || null;
  if (!city) return;
  const { sent } = await notifyCity(city, state);
  await logAction({
    actorId: owner.id,
    action: "waitlist_emailed",
    note: `${city}${state ? `, ${state}` : ""}: ${sent} emailed`,
  });
  revalidatePath("/owner/cities");
  const msg = `Emailed ${sent} ${sent === 1 ? "person" : "people"} waiting on ${city}.`;
  redirect(`/owner/cities?sent=${encodeURIComponent(msg)}#waitlist`);
}

const MAX_ANNOUNCEMENT_HOURS = 24 * 30;

export async function createAnnouncementAction(fd: FormData) {
  const owner = await requireStaff("OWNER");
  if (!owner) redirect("/feed");
  const hours = Math.min(
    Number(fd.get("duration")) || 0,
    MAX_ANNOUNCEMENT_HOURS,
  );
  const parsed = announcementSchema.safeParse({
    message: String(fd.get("message") ?? ""),
    linkUrl: String(fd.get("linkUrl") ?? ""),
    linkLabel: String(fd.get("linkLabel") ?? ""),
    tone: String(fd.get("tone") ?? "info"),
    websiteOnly: fd.get("websiteOnly") === "on",
    endsAt: hours > 0 ? new Date(Date.now() + hours * 3600_000) : null,
  });
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "Check the form and try again.";
    redirect(`/owner/announcements?error=${encodeURIComponent(msg)}`);
  }
  await createAnnouncement(parsed.data, owner.id);
  await logAction({
    actorId: owner.id,
    action: "announcement_posted",
    note: parsed.data.message,
  });
  revalidatePath("/owner/announcements");
  redirect(
    `/owner/announcements?ok=${encodeURIComponent("Published. Members see it on their next page load.")}`,
  );
}

export async function endAnnouncementAction(fd: FormData) {
  const owner = await requireStaff("OWNER");
  if (!owner) redirect("/feed");
  await endAnnouncement(String(fd.get("id") ?? ""));
  revalidatePath("/owner/announcements");
  redirect(`/owner/announcements?ok=${encodeURIComponent("Taken down.")}`);
}
