import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/account-email";

/** Re-sends the confirmation email to the signed-in member. */
export async function POST() {
  const user = await currentAccount();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.emailVerified) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const limited = await limitFor("emailPerUser", `verify:${user.id}`);
  if (!limited.ok) return tooManyRequests(limited);

  const fresh = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { id: true, email: true },
  });
  const sent = await sendVerificationEmail(fresh);
  if (!sent) {
    return NextResponse.json(
      { error: "Email couldn't be sent right now. Please try again later." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true });
}
