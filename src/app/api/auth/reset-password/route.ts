import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthTokenKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { consumeAuthToken } from "@/lib/tokens";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { sendPasswordChangedEmail } from "@/lib/account-email";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request) {
  const limited = await limitFor("forgotPerIp", await clientIp(req));
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Passwords need at least 8 characters." },
      { status: 400 },
    );
  }

  const userId = await consumeAuthToken(
    parsed.data.token,
    AuthTokenKind.PASSWORD_RESET,
  );
  if (!userId) {
    return NextResponse.json(
      {
        error:
          "This reset link has expired or was already used. Request a new one.",
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      sessionVersion: { increment: 1 },
      // Following the emailed link proves the member controls the address.
      emailVerified: new Date(),
    },
    select: { email: true },
  });
  await sendPasswordChangedEmail(user.email);

  return NextResponse.json({ ok: true });
}
