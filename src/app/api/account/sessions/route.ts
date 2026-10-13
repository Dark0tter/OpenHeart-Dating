import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";

/** Signs the member out on every device, including this one. */
export async function DELETE() {
  const user = await currentAccount();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { sessionVersion: { increment: 1 } },
  });
  return NextResponse.json({ ok: true });
}
