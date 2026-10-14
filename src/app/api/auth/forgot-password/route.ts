import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { BOT_CHECK_FAILED, passesBotCheck } from "@/lib/bot-check";
import { sendPasswordResetEmail } from "@/lib/account-email";

const schema = z.object({
  email: z.string().email(),
  botToken: z.string().optional(),
});

/** Always answers the same way so it can't be used to discover who has an account. */
export async function POST(req: Request) {
  const ip = await clientIp(req);
  const limited = await limitFor("forgotPerIp", ip);
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid email." },
      { status: 400 },
    );
  }
  if (!(await passesBotCheck(parsed.data.botToken, ip))) {
    return NextResponse.json({ error: BOT_CHECK_FAILED }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const perEmail = await limitFor("emailPerUser", `reset:${email}`);
  if (perEmail.ok) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, accountStatus: true },
    });
    if (user && user.accountStatus !== AccountStatus.DELETED) {
      await sendPasswordResetEmail(user);
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account uses that email, a reset link is on its way. Check your inbox and spam folder.",
  });
}
