import { NextResponse } from "next/server";
import { z } from "zod";
import { completeAgeVerification, stubAllowed } from "@/lib/verification";

const schema = z.object({
  token: z.string().min(1),
  outcome: z
    .enum(["VERIFIED_ADULT", "NOT_VERIFIED", "REJECTED"])
    .default("VERIFIED_ADULT"),
});

/**
 * Development stub: whoever holds the token can mark themselves verified.
 * Off in production unless ALLOW_VERIFICATION_STUB=true (staging only).
 */
const stubDisabled = () => !stubAllowed();

export async function POST(req: Request) {
  if (stubDisabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid callback" }, { status: 400 });
  }

  const result = await completeAgeVerification(parsed.data);
  if (!result) {
    return NextResponse.json({ error: "Unknown token" }, { status: 404 });
  }

  return NextResponse.json({
    status: result.status,
    verifiedAt: result.verifiedAt,
  });
}

export async function GET(req: Request) {
  if (stubDisabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(
      new URL("/onboarding?verify=missing", req.url),
    );
  }

  const result = await completeAgeVerification({
    token,
    outcome: "VERIFIED_ADULT",
  });
  return NextResponse.redirect(
    new URL(`/onboarding?verify=${result ? "success" : "invalid"}`, req.url),
  );
}
