import { VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

export type VerificationProvider =
  | "persona"
  | "veriff"
  | "stripe_identity"
  | "yoti";

/**
 * Phase 1 stub: starts an age-verification session with the configured provider.
 * Production should call Persona / Veriff / Stripe Identity / Yoti APIs.
 * Never persist government ID images — only tokens + status.
 */
export async function startAgeVerification(
  userId: string,
  provider?: VerificationProvider,
) {
  const selected =
    provider ??
    ((process.env.VERIFICATION_PROVIDER as VerificationProvider) || "persona");

  const verificationToken = randomBytes(24).toString("hex");
  const providerReference = `${selected}_session_${randomBytes(8).toString("hex")}`;

  const record = await prisma.verification.upsert({
    where: { userId },
    create: {
      userId,
      status: VerificationStatus.PENDING,
      provider: selected,
      providerReference,
      verificationToken,
    },
    update: {
      status: VerificationStatus.PENDING,
      provider: selected,
      providerReference,
      verificationToken,
      verifiedAt: null,
    },
  });

  // Stub redirect URL — replace with real provider hosted flow
  const redirectUrl = `/api/verification/callback?token=${verificationToken}&provider=${selected}`;

  return {
    verificationId: record.id,
    provider: selected,
    providerReference,
    redirectUrl,
    note: "Stub session. Wire provider SDK/API before production launch.",
  };
}

/** Webhook/callback handler stub — marks adult verified without storing ID media. */
export async function completeAgeVerification(opts: {
  token: string;
  outcome: "VERIFIED_ADULT" | "NOT_VERIFIED" | "REJECTED";
}) {
  const existing = await prisma.verification.findFirst({
    where: { verificationToken: opts.token },
  });
  if (!existing) return null;

  return prisma.verification.update({
    where: { id: existing.id },
    data: {
      status: opts.outcome as VerificationStatus,
      verifiedAt:
        opts.outcome === "VERIFIED_ADULT" ? new Date() : existing.verifiedAt,
    },
  });
}

export async function isVerifiedAdult(userId: string): Promise<boolean> {
  const v = await prisma.verification.findUnique({ where: { userId } });
  return v?.status === VerificationStatus.VERIFIED_ADULT;
}
