import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMember } from "@/lib/session";
import {
  enforceSolicitationPolicy,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";

const schema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export async function POST(req: Request) {
  const user = await requireMember();
  if (!user) {
    return NextResponse.json(
      { error: "Activate your profile to post." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid post" }, { status: 400 });
  }

  const solicitation = await enforceSolicitationPolicy({
    userId: user.id,
    context: "post",
    fields: { body: parsed.data.body },
  });
  if (solicitation.blocked) {
    return NextResponse.json(solicitationErrorBody(solicitation.labels), {
      status: 422,
    });
  }

  const post = await prisma.post.create({
    data: { authorId: user.id, body: parsed.data.body },
  });
  return NextResponse.json({ id: post.id });
}
