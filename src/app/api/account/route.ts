import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";
import { deleteAccount } from "@/lib/account-deletion";

const schema = z.object({
  password: z.string().min(1),
  confirm: z.literal("DELETE"),
});

/**
 * Permanent account deletion, available in-app and on the web (required by
 * both app stores), including for suspended accounts.
 */
export async function DELETE(req: Request) {
  const user = await currentAccount();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Type DELETE and enter your password to confirm." },
      { status: 400 },
    );
  }

  if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
  }

  await deleteAccount(prisma, user.id);
  return NextResponse.json({ deleted: true });
}
