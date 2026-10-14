import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import {
  startAgeVerification,
  verificationAvailable,
} from "@/lib/verification";

export async function POST() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.verification?.status === "VERIFIED_ADULT") {
    return NextResponse.json(
      { error: "Your age is already verified." },
      { status: 409 },
    );
  }
  if (!verificationAvailable()) {
    return NextResponse.json(
      {
        error:
          "Age verification isn't open yet. We'll email you as soon as it is.",
      },
      { status: 503 },
    );
  }

  const session = await startAgeVerification(user.id);
  return NextResponse.json(session);
}
