import { NextResponse } from "next/server";
import { z } from "zod";
import { ReportReason } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { priorityForReason } from "@/lib/safety";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";

const schema = z.object({
  reportedUserId: z.string().min(1),
  reason: z.nativeEnum(ReportReason),
  details: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await limitFor("reportsPerUser", user.id);
  if (!limited.ok) {
    return tooManyRequests(
      limited,
      "You've filed many reports today. For emergencies, contact local emergency services.",
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }

  if (parsed.data.reportedUserId === user.id) {
    return NextResponse.json(
      { error: "Cannot report yourself" },
      { status: 400 },
    );
  }

  const report = await prisma.report.create({
    data: {
      reporterId: user.id,
      reportedUserId: parsed.data.reportedUserId,
      reason: parsed.data.reason,
      details: parsed.data.details,
      priority: priorityForReason(parsed.data.reason),
    },
  });

  return NextResponse.json({
    report: {
      id: report.id,
      priority: report.priority,
      status: report.status,
    },
  });
}
