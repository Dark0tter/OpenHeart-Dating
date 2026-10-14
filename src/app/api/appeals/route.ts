import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountStatus, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({ message: z.string().trim().min(20).max(4000) });

export async function POST(req: Request) {
  const user = await currentAccount();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.accountStatus !== AccountStatus.SUSPENDED) {
    return NextResponse.json(
      { error: "Your account isn't suspended." },
      { status: 400 },
    );
  }

  const limited = await limitFor("appealsPerUser", user.id);
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please write at least a couple of sentences." },
      { status: 400 },
    );
  }

  const pending = await prisma.appeal.count({
    where: { userId: user.id, status: ReviewStatus.PENDING },
  });
  if (pending > 0) {
    return NextResponse.json(
      { error: "You already have an appeal waiting for review." },
      { status: 409 },
    );
  }

  await prisma.appeal.create({
    data: { userId: user.id, message: parsed.data.message },
  });
  return NextResponse.json({ ok: true });
}
