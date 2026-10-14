import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { emailConfigured, sendEmail } from "@/lib/email";

const MAX_ACTIVE = 3;

export async function GET() {
  const user = await requireUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const checkIns = await prisma.safetyCheckIn.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json({ checkIns });
}

const createSchema = z
  .object({
    meetingWith: z.string().trim().min(1).max(200),
    place: z.string().trim().min(2).max(300),
    startsAt: z.coerce.date(),
    checkInBy: z.coerce.date(),
    contactName: z.string().trim().min(1).max(80),
    contactEmail: z.string().trim().email().max(200),
    note: z.string().trim().max(1000).optional(),
    tellContactNow: z.boolean().default(false),
  })
  .refine((c) => c.checkInBy > c.startsAt, {
    message: "Your check-in time should be after the date starts.",
  });

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.NODE_ENV === "production" && !emailConfigured()) {
    return NextResponse.json(
      {
        error:
          "Date check-ins aren't available right now because we can't send email. Please tell a friend your plans directly.",
      },
      { status: 503 },
    );
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check the details." },
      { status: 400 },
    );
  }
  const { tellContactNow, ...data } = parsed.data;
  if (data.checkInBy.getTime() < Date.now() + 5 * 60_000) {
    return NextResponse.json(
      { error: "Pick a check-in time at least 5 minutes from now." },
      { status: 400 },
    );
  }
  if (data.checkInBy.getTime() > Date.now() + 14 * 86400_000) {
    return NextResponse.json(
      { error: "Set up a check-in within two weeks of the date." },
      { status: 400 },
    );
  }
  const active = await prisma.safetyCheckIn.count({
    where: { userId: user.id, status: "active" },
  });
  if (active >= MAX_ACTIVE) {
    return NextResponse.json(
      { error: "You already have several check-ins running." },
      { status: 409 },
    );
  }

  const checkIn = await prisma.safetyCheckIn.create({
    data: { ...data, userId: user.id },
  });

  if (tellContactNow) {
    const name = user.profile?.displayName ?? "A friend";
    await sendEmail({
      to: data.contactEmail,
      subject: `${name} added you as their safety contact`,
      paragraphs: [
        `Hi ${data.contactName}, ${name} is going on a date and asked OpenHeart to email you if they don't check in by ${data.checkInBy.toUTCString()}.`,
        "You don't need to do anything now. If you get a second email saying they haven't checked in, please try to reach them.",
      ],
    });
  }
  return NextResponse.json({ checkIn });
}

const patchSchema = z.object({
  id: z.string(),
  action: z.enum(["safe", "cancel", "extend"]),
  minutes: z.number().int().min(15).max(240).optional(),
});

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { id, action, minutes } = parsed.data;

  const checkIn = await prisma.safetyCheckIn.findFirst({
    where: { id, userId: user.id, status: { in: ["active", "alerted"] } },
  });
  if (!checkIn)
    return NextResponse.json({ error: "Check-in not found" }, { status: 404 });

  if (action === "extend") {
    if (checkIn.status !== "active") {
      return NextResponse.json(
        { error: "This check-in already ended." },
        { status: 409 },
      );
    }
    const base = Math.max(checkIn.checkInBy.getTime(), Date.now());
    await prisma.safetyCheckIn.update({
      where: { id },
      data: {
        checkInBy: new Date(base + (minutes ?? 60) * 60_000),
        remindedAt: null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.safetyCheckIn.update({
    where: { id },
    data: {
      status: action === "safe" ? "safe" : "cancelled",
      endedAt: new Date(),
    },
  });

  // If the contact was already alerted, tell them it's OK now.
  if (checkIn.status === "alerted" && action === "safe") {
    const name = user.profile?.displayName ?? "Your friend";
    await sendEmail({
      to: checkIn.contactEmail,
      subject: `${name} has checked in and is safe`,
      paragraphs: [
        `Good news: ${name} just checked in on OpenHeart and says they're safe.`,
      ],
    });
  }
  return NextResponse.json({ ok: true });
}
