"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ContentTier, SponsorLabel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { logAction } from "@/lib/moderation/staff-actions";
import { hasExplicit } from "@/lib/moderation/app-text";
import { appUrl } from "@/lib/request";
import { isSafeSponsorUrl } from "@/lib/sponsors";
import { APPROVAL_CHECKS } from "@/lib/sponsor-review";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

async function adminOrThrow() {
  const staff = await requireStaff("ADMIN");
  if (!staff) throw new Error("Only admins can manage sponsors");
  return staff;
}

function fail(message: string, id?: string): never {
  const q = new URLSearchParams({ error: message });
  if (id) q.set("edit", id);
  redirect(`/mod/sponsors?${q}#form`);
}

const slugs = (raw: string) =>
  raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9-]{1,60}$/.test(s))
    .slice(0, 30);

/** Form dates are entered in UTC (`YYYY-MM-DDTHH:mm`). */
const date = (raw: string) => {
  if (!raw) return null;
  const d = new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw) ? `${raw}:00Z` : raw,
  );
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Create or edit. Any edit sends the placement back for approval. */
export async function saveSponsor(fd: FormData) {
  const staff = await adminOrThrow();
  const id = text(fd, "id") || undefined;
  const sponsorName = text(fd, "sponsorName");
  const title = text(fd, "title");
  const body = text(fd, "body");
  const linkUrl = text(fd, "linkUrl");
  const label = text(fd, "label") as SponsorLabel;

  if (!sponsorName || sponsorName.length > 80) {
    fail("Sponsor name is required (up to 80 characters).", id);
  }
  if (!title || title.length > 80) {
    fail("Title is required (up to 80 characters).", id);
  }
  if (body.length > 240) fail("Description can be up to 240 characters.", id);
  if (!Object.values(SponsorLabel).includes(label)) fail("Pick a label.", id);
  if (!isSafeSponsorUrl(linkUrl) || linkUrl.startsWith(appUrl())) {
    fail("The link must be an https address on the sponsor's own site.", id);
  }
  const dailyCap = Math.min(10, Math.max(1, Number(text(fd, "dailyCap")) || 3));
  const startsAt = date(text(fd, "startsAt")) ?? new Date();
  const endsAt = date(text(fd, "endsAt"));
  if (endsAt && endsAt <= startsAt)
    fail("The end date must be after the start.", id);

  const data = {
    sponsorName,
    title,
    body: body || null,
    linkUrl,
    label,
    targetKinkSlugs: slugs(text(fd, "targetKinkSlugs")),
    targetGoalSlugs: slugs(text(fd, "targetGoalSlugs")),
    dailyCap,
    startsAt,
    endsAt,
    staffNotes: text(fd, "staffNotes").slice(0, 2000) || null,
    approvedAt: null,
    approvedById: null,
    contentTier: ContentTier.WEB_ONLY,
  };
  const saved = id
    ? await prisma.sponsorPlacement.update({ where: { id }, data })
    : await prisma.sponsorPlacement.create({ data });
  await logAction({
    actorId: staff.id,
    action: id ? "sponsor_edit" : "sponsor_create",
    note: `sponsor:${saved.id} ${sponsorName}`,
  });
  revalidatePath("/mod/sponsors");
  redirect("/mod/sponsors?saved=1");
}

export async function approveSponsor(fd: FormData) {
  const staff = await adminOrThrow();
  const id = text(fd, "id");
  const where = text(fd, "where");
  const tier =
    where === "everywhere" ? ContentTier.STANDARD : ContentTier.WEB_ONLY;

  if (APPROVAL_CHECKS.some(([key]) => fd.get(key) !== "on")) {
    fail("Tick every box on the checklist before approving.");
  }
  const p = await prisma.sponsorPlacement.findUniqueOrThrow({ where: { id } });
  if (!isSafeSponsorUrl(p.linkUrl)) fail("The link must be https.");
  if (
    tier === ContentTier.STANDARD &&
    hasExplicit([p.sponsorName, p.title, p.body ?? ""].join(" "))
  ) {
    fail(
      "This wording can't go in the apps. Approve it for the website only, or edit the text.",
    );
  }

  await prisma.sponsorPlacement.update({
    where: { id },
    data: { approvedAt: new Date(), approvedById: staff.id, contentTier: tier },
  });
  await logAction({
    actorId: staff.id,
    action: "sponsor_approve",
    note: `sponsor:${id} ${tier === ContentTier.STANDARD ? "everywhere" : "website only"}`,
  });
  revalidatePath("/mod/sponsors");
}

export async function sponsorStatus(fd: FormData) {
  const staff = await adminOrThrow();
  const id = text(fd, "id");
  const action = text(fd, "action");
  if (action === "delete") {
    await prisma.sponsorPlacement.delete({ where: { id } });
  } else {
    await prisma.sponsorPlacement.update({
      where: { id },
      data: { isActive: action === "resume" },
    });
  }
  await logAction({
    actorId: staff.id,
    action: `sponsor_${action}`,
    note: `sponsor:${id}`,
  });
  revalidatePath("/mod/sponsors");
}
