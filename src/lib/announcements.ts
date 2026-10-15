import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const announcementSchema = z.object({
  message: z.string().trim().min(3).max(280),
  linkUrl: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || null)
    .refine(
      (v) =>
        !v ||
        (v.startsWith("/") && !v.startsWith("//")) ||
        /^https:\/\//i.test(v),
      "Links must start with / (a page on this site) or https://",
    ),
  linkLabel: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v || null),
  tone: z.enum(["info", "warning"]),
  websiteOnly: z.boolean(),
  endsAt: z.date().nullable(),
});

export type AnnouncementInput = z.infer<typeof announcementSchema>;

/** What a member sees right now. The phone apps skip website-only ones. */
export function currentAnnouncements(opts: { app: boolean }, now = new Date()) {
  return prisma.announcement.findMany({
    where: {
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      ...(opts.app ? { websiteOnly: false } : {}),
    },
    orderBy: { startsAt: "desc" },
    take: 3,
    select: {
      id: true,
      message: true,
      linkUrl: true,
      linkLabel: true,
      tone: true,
    },
  });
}

export function createAnnouncement(
  input: AnnouncementInput,
  createdById: string,
) {
  return prisma.announcement.create({ data: { ...input, createdById } });
}

export function endAnnouncement(id: string, now = new Date()) {
  return prisma.announcement.updateMany({
    where: { id, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    data: { endsAt: now },
  });
}
