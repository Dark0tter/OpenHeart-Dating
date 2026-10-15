import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/request";

/**
 * People who'd rather wait until their city has enough members. Entries
 * need a confirmed email, are deleted after a week if never confirmed, and
 * are deleted as soon as we've told them their city is ready.
 */

const DAY = 24 * 60 * 60 * 1000;
export const UNCONFIRMED_TTL_MS = 7 * DAY;

export function waitlistThreshold(): number {
  const n = Number(process.env.WAITLIST_NOTIFY_AT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
}

const place = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  city: z.string().trim().min(2).max(80),
  state: place(80),
  country: place(80),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;

const key = (s: string | null | undefined) => s?.trim().toLowerCase() || null;

/** Adds or updates an entry and emails a confirmation link. */
export async function joinWaitlist(input: WaitlistInput) {
  const token = randomBytes(24).toString("base64url");
  const existing = await prisma.waitlistEntry.findUnique({
    where: { email: input.email },
  });
  const keepConfirmed = Boolean(existing?.confirmedAt);
  const entry = await prisma.waitlistEntry.upsert({
    where: { email: input.email },
    create: { ...input, token },
    update: {
      city: input.city,
      state: input.state,
      country: input.country,
      ...(keepConfirmed
        ? {}
        : { token, confirmedAt: null, createdAt: new Date() }),
    },
  });
  if (!keepConfirmed) {
    await sendEmail({
      to: input.email,
      subject: "Confirm your spot on the Kindred Kinks waiting list",
      paragraphs: [
        `Confirm and we'll email you once Kindred Kinks has ${waitlistThreshold()} members near ${input.city}. That's the only email we'll send.`,
        "If you didn't ask for this, ignore this email and we'll delete your address in a week.",
      ],
      action: {
        label: "Confirm",
        url: `${appUrl()}/waitlist/confirm?token=${encodeURIComponent(entry.token)}`,
      },
    });
  }
  return { alreadyConfirmed: keepConfirmed };
}

export async function confirmWaitlist(token: string) {
  const res = await prisma.waitlistEntry.updateMany({
    where: { token, confirmedAt: null },
    data: { confirmedAt: new Date() },
  });
  if (res.count === 1) return true;
  return Boolean(await prisma.waitlistEntry.findUnique({ where: { token } }));
}

export async function leaveWaitlist(token: string) {
  const res = await prisma.waitlistEntry.deleteMany({ where: { token } });
  return res.count === 1;
}

/** Live (verified, visible) members in a city; state only narrows it when both sides have one. */
export async function liveMembersIn(city: string, state: string | null) {
  const c = key(city);
  const s = key(state);
  const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n
    FROM "Profile" p
    JOIN "User" u ON u."id" = p."userId"
    JOIN "Verification" v ON v."userId" = u."id"
    WHERE u."accountStatus" = 'ACTIVE' AND p."isActive" AND v."status" = 'VERIFIED_ADULT'
      AND lower(trim(p."city")) = ${c}
      AND (${s}::text IS NULL OR nullif(trim(p."state"), '') IS NULL OR lower(trim(p."state")) = ${s})`;
  return Number(n);
}

/** Confirmed people still waiting, grouped by city, most wanted first. */
export async function waitlistDemand(limit = 100) {
  const rows = await prisma.$queryRaw<
    {
      city: string;
      state: string | null;
      country: string | null;
      waiting: bigint;
    }[]
  >`
    SELECT min(trim("city")) AS city,
           min(nullif(trim("state"), '')) AS state,
           min(nullif(trim("country"), '')) AS country,
           count(*) AS waiting
    FROM "WaitlistEntry"
    WHERE "confirmedAt" IS NOT NULL
    GROUP BY lower(trim("city")), lower(trim(coalesce("state", '')))
    ORDER BY waiting DESC
    LIMIT ${limit}`;
  return Promise.all(
    rows.map(async (r) => ({
      city: r.city,
      state: r.state,
      country: r.country,
      waiting: Number(r.waiting),
      live: await liveMembersIn(r.city, r.state),
    })),
  );
}

/** Emails everyone waiting on one city, then deletes their entries. */
export async function notifyCity(city: string, state: string | null) {
  const c = key(city);
  const s = key(state);
  const live = await liveMembersIn(city, state);
  const entries = await prisma.$queryRaw<
    { id: string; email: string; token: string; city: string }[]
  >`
    SELECT "id", "email", "token", "city" FROM "WaitlistEntry"
    WHERE "confirmedAt" IS NOT NULL
      AND lower(trim("city")) = ${c}
      AND lower(trim(coalesce("state", ''))) = ${s ?? ""}
    LIMIT 500`;
  let sent = 0;
  for (const e of entries) {
    const ok = await sendEmail({
      to: e.email,
      subject: `Kindred Kinks is ready in ${e.city}`,
      paragraphs: [
        `You asked us to tell you when Kindred Kinks had more people near ${e.city}. There are now ${live} verified members there.`,
        "Joining is free, and setting up takes about five minutes. This is the only email you'll get from the waiting list, and we've now deleted your address from it.",
      ],
      action: { label: "Join free", url: `${appUrl()}/register` },
    });
    if (!ok) continue;
    await prisma.waitlistEntry.delete({ where: { id: e.id } });
    sent++;
  }
  return { live, sent };
}

/** Background job: tells each city's waiting list once it reaches the threshold. */
export async function notifyReadyCities() {
  const threshold = waitlistThreshold();
  let sent = 0;
  for (const d of await waitlistDemand(50)) {
    if (d.live < threshold) continue;
    sent += (await notifyCity(d.city, d.state)).sent;
  }
  return sent;
}

export async function cleanUpWaitlist(now = new Date()) {
  const res = await prisma.waitlistEntry.deleteMany({
    where: {
      confirmedAt: null,
      createdAt: { lt: new Date(now.getTime() - UNCONFIRMED_TTL_MS) },
    },
  });
  return res.count;
}
