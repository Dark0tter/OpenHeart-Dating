import { NextResponse } from "next/server";
import { z } from "zod";
import { AdPreference } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isSupporter } from "@/lib/supporter";
import { isAppRequest } from "@/lib/content-policy";
import { FLAG_IDS, THEME_MODES } from "@/lib/themes";

const schema = z
  .object({
    adPreference: z.nativeEnum(AdPreference).optional(),
    showOnline: z.boolean().optional(),
    notifyEmail: z.boolean().optional(),
    readReceipts: z.boolean().optional(),
    allowCalls: z.boolean().optional(),
    themeMode: z.enum(THEME_MODES).optional(),
    themeFlag: z
      .string()
      .refine((id) => FLAG_IDS.includes(id))
      .nullable()
      .optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined));

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const inApp = await isAppRequest();
  return NextResponse.json({
    adPreference: user.adPreference,
    showOnline: user.showOnline,
    notifyEmail: user.notifyEmail,
    readReceipts: user.readReceipts,
    allowCalls: user.allowCalls,
    themeMode: user.themeMode,
    themeFlag: user.themeFlag,
    inApp,
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
      { error: "This option is only available on the website." },
      { status: 403 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: {
      adPreference: true,
      showOnline: true,
      notifyEmail: true,
      readReceipts: true,
      allowCalls: true,
      themeMode: true,
      themeFlag: true,
    },
  });
  return NextResponse.json(updated);
}
