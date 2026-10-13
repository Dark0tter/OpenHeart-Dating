import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdult } from "@/lib/utils";
import {
  findSolicitation,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  dateOfBirth: z.string(),
  displayName: z.string().min(2).max(40),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid registration data", details: parsed.error.flatten() },
        { status: 400 },
      );
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

    return NextResponse.json({
      user,
      next: "complete_profile_and_age_verification",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
