import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/request";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { BOT_CHECK_FAILED, passesBotCheck } from "@/lib/bot-check";
import { joinWaitlist, waitlistSchema } from "@/lib/waitlist";

const schema = waitlistSchema.extend({ botToken: z.string().optional() });

export async function POST(req: Request) {
  const ip = await clientIp(req);
  const limited = await limitFor("waitlistPerIp", ip);
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter your email and city." },
      { status: 400 },
    );
  }
  const { botToken, ...input } = parsed.data;
  if (!(await passesBotCheck(botToken, ip))) {
    return NextResponse.json({ error: BOT_CHECK_FAILED }, { status: 400 });
  }
  const { alreadyConfirmed } = await joinWaitlist(input);
  return NextResponse.json({ ok: true, alreadyConfirmed });
}
