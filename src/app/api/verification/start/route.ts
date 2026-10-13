import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { startAgeVerification } from "@/lib/verification";

export async function POST() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await startAgeVerification(user.id);
  return NextResponse.json(session);
}
