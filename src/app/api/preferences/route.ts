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
    appAdultContent: z.boolean().optional(),
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
  return NextResponse.json({
    adPreference: user.adPreference,
    showOnline: user.showOnline,
    appAdultContent: user.appAdultContent,
    themeMode: user.themeMode,
    themeFlag: user.themeFlag,
    verifiedAdult: user.verification?.status === "VERIFIED_ADULT",
    inApp: await isAppRequest(),
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

  if (parsed.data.appAdultContent !== undefined) {
    // Store rules: adult content in the apps may only be enabled off-app.
    if (await isAppRequest()) {
      return NextResponse.json(
        { error: "Change this setting on the OpenHeart website." },
        { status: 403 },
      );
    }
    if (
      parsed.data.appAdultContent &&
      user.verification?.status !== "VERIFIED_ADULT"
    ) {
      return NextResponse.json(
        { error: "Verify your age before turning this on." },
        { status: 403 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: parsed.data,
    select: {
      adPreference: true,
      showOnline: true,
      appAdultContent: true,
      themeMode: true,
      themeFlag: true,
    },
  });
  return NextResponse.json(updated);
}
