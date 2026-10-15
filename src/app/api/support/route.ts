import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { clientIp } from "@/lib/request";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { BOT_CHECK_FAILED, passesBotCheck } from "@/lib/bot-check";
import { sendEmail } from "@/lib/email";
import { SUPPORT_EMAIL } from "@/lib/constants/site";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_IDS,
} from "@/lib/constants/support";

const schema = z.object({
  email: z.string().trim().email().max(200),
  category: z.enum(SUPPORT_CATEGORY_IDS),
  subject: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(5000),
  botToken: z.string().optional(),
});

export async function POST(req: Request) {
  const ip = await clientIp(req);
  const limited = await limitFor("supportPerIp", ip);
  if (!limited.ok) return tooManyRequests(limited);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fill in every field." },
      { status: 400 },
    );
  }
  if (!(await passesBotCheck(parsed.data.botToken, ip))) {
    return NextResponse.json({ error: BOT_CHECK_FAILED }, { status: 400 });
  }

  const user = await currentAccount();
  const { email, category, subject, body } = parsed.data;
  const data = { email, category, subject, body };
  const ticket = await prisma.supportTicket.create({
    data: { ...data, userId: user?.id ?? null },
  });

  const label =
    SUPPORT_CATEGORIES.find((c) => c.id === data.category)?.label ??
    data.category;
  await sendEmail({
    to: data.email,
    subject: `We got your message: ${data.subject}`,
    paragraphs: [
      `Thanks for contacting Kindred Kinks. Your request (${label}) is number ${ticket.id.slice(0, 8)}. We'll reply to this address.`,
      "If someone is in immediate danger, contact local emergency services first.",
    ],
  });
  if (SUPPORT_EMAIL) {
    await sendEmail({
      to: SUPPORT_EMAIL,
      subject: `[${data.category}] ${data.subject}`,
      paragraphs: [
        `From: ${data.email}${user ? ` (member ${user.id})` : ""}`,
        data.body,
      ],
    });
  }

  return NextResponse.json({ ok: true, ticket: ticket.id.slice(0, 8) });
}
