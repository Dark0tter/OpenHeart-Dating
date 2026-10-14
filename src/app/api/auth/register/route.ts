import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdult } from "@/lib/utils";
import {
  findSolicitation,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { BOT_CHECK_FAILED, passesBotCheck } from "@/lib/bot-check";
import { sendVerificationEmail } from "@/lib/account-email";
import { emailBanHash, isBanned } from "@/lib/bans";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  dateOfBirth: z.string(),
  displayName: z.string().min(2).max(40),
  acceptTerms: z.literal(true),
  botToken: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const ip = await clientIp(req);
    const limited = await limitFor("registerPerIp", ip);
    if (!limited.ok) return tooManyRequests(limited);

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const termsMissing = parsed.error.issues.some(
        (i) => i.path[0] === "acceptTerms",
      );
      return NextResponse.json(
        {
          error: termsMissing
            ? "Please accept the Terms and Community Guidelines to join."
            : "Invalid registration data",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    if (!(await passesBotCheck(parsed.data.botToken, ip))) {
      return NextResponse.json({ error: BOT_CHECK_FAILED }, { status: 400 });
    }

    const dob = new Date(parsed.data.dateOfBirth);
    if (Number.isNaN(dob.getTime()) || !isAdult(dob)) {
      return NextResponse.json(
        { error: "You must be 18 or older to join OpenHeart." },
        { status: 400 },
      );
    }

    const solicitation = findSolicitation({
      displayName: parsed.data.displayName,
    });
    if (solicitation.length > 0) {
      return NextResponse.json(
        solicitationErrorBody([...new Set(solicitation.map((m) => m.label))]),
        { status: 422 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    if (await isBanned(emailBanHash(email))) {
      return NextResponse.json(
        { error: "We can't create an account with this email." },
        { status: 403 },
      );
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        dateOfBirth: dob,
        termsAcceptedAt: new Date(),
        verification: { create: { status: "NOT_VERIFIED" } },
        profile: {
          create: {
            displayName: parsed.data.displayName.trim(),
            isActive: false,
            visibility: "PUBLIC",
          },
        },
      },
      select: { id: true, email: true },
    });

    await sendVerificationEmail(user);

    return NextResponse.json({
      user,
      next: "complete_profile_and_age_verification",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
