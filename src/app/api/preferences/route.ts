import { NextResponse } from "next/server";
import { z } from "zod";
import { AdPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isSupporter } from "@/lib/supporter";

const schema = z
  .object({
    adPreference: z.nativeEnum(AdPreference).optional(),
    showOnline: z.boolean().optional(),
  })
  .refine((v) => v.adPreference !== undefined || v.showOnline !== undefined);

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    adPreference: user.adPreference,
    showOnline: user.showOnline,
    isSupporter: await isSupporter(user.id),
  });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preference" }, { status: 400 });
  }

  if (
    parsed.data.adPreference === AdPreference.NONE &&
    !(await isSupporter(user.id))
  ) {
    return NextResponse.json(
      { error: "Hiding the sponsor block is a supporter perk." },
      { status: 403 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: { adPreference: true, showOnline: true },
  });
  return NextResponse.json(updated);
}
