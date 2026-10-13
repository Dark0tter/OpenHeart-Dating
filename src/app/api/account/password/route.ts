import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { sendPasswordChangedEmail } from "@/lib/account-email";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

/** Changes the password and signs out every device, including this one. */
export async function POST(req: Request) {
  const user = await currentAccount();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await limitFor("loginPerEmail", user.email);
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "New passwords need at least 8 characters." },
      { status: 400 },
    );
  }
  if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json(
      { error: "Your current password is incorrect." },
      { status: 403 },
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(parsed.data.newPassword, 12),
      sessionVersion: { increment: 1 },
    },
  });
  await sendPasswordChangedEmail(user.email);
  return NextResponse.json({ ok: true });
}
