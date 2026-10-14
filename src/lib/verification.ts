import { VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { appUrl } from "@/lib/request";

export type VerificationProvider =
  "persona" | "veriff" | "stripe_identity" | "yoti";

export function personaConfigured(): boolean {
  return Boolean(
    process.env.PERSONA_TEMPLATE_ID &&
    process.env.PERSONA_ENVIRONMENT_ID &&
    process.env.PERSONA_WEBHOOK_SECRET,
  );
}

/**
 * Starts an age-verification session. With Persona configured, the member is
 * sent to Persona's hosted flow and the result arrives by signed webhook
 * (/api/verification/persona-webhook). Otherwise a dev stub is used, which is
 * disabled in production. ID images and birthdates are never stored here —
 * only a reference and the outcome.
 */
export async function startAgeVerification(
  userId: string,
  provider?: VerificationProvider,
) {
  const selected =
    provider ??
    ((process.env.VERIFICATION_PROVIDER as VerificationProvider) || "persona");

  const verificationToken = randomBytes(24).toString("hex");
  const providerReference = `${selected}_ref_${randomBytes(12).toString("hex")}`;

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

  if (selected === "persona" && personaConfigured()) {
    const url = new URL("https://withpersona.com/verify");
    url.searchParams.set(
      "inquiry-template-id",
      process.env.PERSONA_TEMPLATE_ID!,
    );
    url.searchParams.set("environment-id", process.env.PERSONA_ENVIRONMENT_ID!);
    url.searchParams.set("reference-id", providerReference);
    url.searchParams.set(
      "redirect-uri",
      `${appUrl()}/onboarding?verify=pending`,
    );
    return {
      verificationId: record.id,
      provider: selected,
      redirectUrl: url.toString(),
    };
  }

  return {
    verificationId: record.id,
    provider: selected,
    redirectUrl: `/api/verification/callback?token=${verificationToken}&provider=${selected}`,
    note: "Development stub — set PERSONA_* to use real verification.",
  };
}

/** Whole years between a YYYY-MM-DD birthdate and now. */
export function ageFromBirthdate(
  birthdate: string,
  now = new Date(),
): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthdate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < mo ||
    (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * Applies a provider decision to the verification with this reference. If the
 * provider reports the person is under 18, the account is suspended and an
 * UNDERAGE report is opened for staff.
 */
export async function applyProviderDecision(opts: {
  providerReference: string;
  outcome: "VERIFIED_ADULT" | "NOT_VERIFIED" | "REJECTED";
  underage?: boolean;
}) {
  const existing = await prisma.verification.findFirst({
    where: { providerReference: opts.providerReference },
  });
  if (!existing) return null;

  const updated = await prisma.verification.update({
    where: { id: existing.id },
    data: {
      status: opts.outcome as VerificationStatus,
      verifiedAt: opts.outcome === "VERIFIED_ADULT" ? new Date() : null,
      verificationToken: null,
    },
  });

  if (opts.underage) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.userId },
        data: { accountStatus: "SUSPENDED", sessionVersion: { increment: 1 } },
      }),
      prisma.report.create({
        data: {
          reportedUserId: existing.userId,
          reason: "UNDERAGE",
          source: "AUTOMATED",
          priority: "HIGH",
          details:
            "Age verification provider reported this person is under 18.",
        },
      }),
      prisma.modAction.create({
        data: {
          action: "suspend",
          targetUserId: existing.userId,
          note: "Automatic: age verification reported under 18",
        },
      }),
    ]);
  }
  return updated;
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
