import { VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { appUrl } from "@/lib/request";
import { banUser, identityBanHash, isBanned } from "@/lib/bans";
import { notify } from "@/lib/notify";
import { redactPersonaInquiry } from "@/lib/persona";
import {
  createDiditSession,
  deleteDiditSession,
  diditConfigured,
} from "@/lib/didit";
import {
  createVeriffSession,
  deleteVeriffSession,
  veriffConfigured,
} from "@/lib/veriff";
import type {
  ProviderDecision,
  VerificationOutcome,
} from "@/lib/verification-decision";

export { ageFromBirthdate } from "@/lib/verification-decision";

export const PROVIDERS = ["didit", "persona", "veriff"] as const;
export type VerificationProvider = (typeof PROVIDERS)[number];

/** The dev stub is never used in production unless explicitly allowed (staging). */
export function stubAllowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_VERIFICATION_STUB === "true"
  );
}

export function personaConfigured(): boolean {
  return Boolean(
    process.env.PERSONA_TEMPLATE_ID &&
    process.env.PERSONA_ENVIRONMENT_ID &&
    process.env.PERSONA_WEBHOOK_SECRET,
  );
}

export function providerConfigured(p: VerificationProvider): boolean {
  if (p === "didit") return diditConfigured();
  if (p === "veriff") return veriffConfigured();
  return personaConfigured();
}

/**
 * VERIFICATION_PROVIDER picks the provider when it's set up; otherwise the
 * first one with keys is used.
 */
export function activeProvider(): VerificationProvider | null {
  const chosen = process.env.VERIFICATION_PROVIDER as VerificationProvider;
  if (PROVIDERS.includes(chosen) && providerConfigured(chosen)) return chosen;
  return PROVIDERS.find(providerConfigured) ?? null;
}

export function verificationAvailable(): boolean {
  return activeProvider() !== null || stubAllowed();
}

/**
 * Starts an age-verification session. The member is sent to the provider's
 * hosted flow and the result arrives by signed webhook. Without a provider a
 * dev stub is used, which is disabled in production. ID images and
 * birthdates are never stored here — only a reference and the outcome.
 */
export async function startAgeVerification(userId: string) {
  const provider = activeProvider();
  const label = provider ?? "stub";
  const verificationToken = randomBytes(24).toString("hex");
  const providerReference = `${label}_ref_${randomBytes(12).toString("hex")}`;
  const callback = `${appUrl()}/onboarding?verify=pending`;

  // A restarted check replaces the old one; erase whatever the old one held.
  const previous = await prisma.verification.findUnique({
    where: { userId },
    select: {
      provider: true,
      providerSessionId: true,
      providerDataDeletedAt: true,
    },
  });
  if (previous?.providerSessionId && !previous.providerDataDeletedAt) {
    await deleteProviderData(previous.provider, previous.providerSessionId);
  }

  const record = await prisma.verification.upsert({
    where: { userId },
    create: {
      userId,
      status: VerificationStatus.PENDING,
      provider: label,
      providerReference,
      verificationToken,
    },
    update: {
      status: VerificationStatus.PENDING,
      provider: label,
      providerReference,
      verificationToken,
      verifiedAt: null,
      providerSessionId: null,
      providerDataDeletedAt: null,
    },
  });

  if (provider === "didit" || provider === "veriff") {
    const session =
      provider === "didit"
        ? await createDiditSession({ reference: providerReference, callback })
        : await createVeriffSession({ reference: providerReference, callback });
    await prisma.verification.update({
      where: { id: record.id },
      data: { providerSessionId: session.sessionId },
    });
    return { verificationId: record.id, provider, redirectUrl: session.url };
  }

  if (provider === "persona") {
    const url = new URL("https://withpersona.com/verify");
    url.searchParams.set(
      "inquiry-template-id",
      process.env.PERSONA_TEMPLATE_ID!,
    );
    url.searchParams.set("environment-id", process.env.PERSONA_ENVIRONMENT_ID!);
    url.searchParams.set("reference-id", providerReference);
    url.searchParams.set("redirect-uri", callback);
    return { verificationId: record.id, provider, redirectUrl: url.toString() };
  }

  return {
    verificationId: record.id,
    provider: label,
    redirectUrl: `/api/verification/callback?token=${verificationToken}&provider=stub`,
    note: "Development stub — set up a verification provider for real checks.",
  };
}

/** Asks the provider to erase its copy of a check (ID images, selfie, data). */
export async function deleteProviderData(
  provider: string | null,
  sessionId: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!sessionId) return false;
  if (provider === "didit") return deleteDiditSession(sessionId, fetchImpl);
  if (provider === "veriff") return deleteVeriffSession(sessionId, fetchImpl);
  if (provider === "persona") return redactPersonaInquiry(sessionId, fetchImpl);
  return false;
}

/**
 * Applies a provider decision to the verification with this reference. If the
 * provider reports the person is under 18, the account is suspended and an
 * UNDERAGE report is opened for staff.
 */
export async function applyProviderDecision(opts: {
  providerReference: string;
  outcome: VerificationOutcome;
  underage?: boolean;
  identityHash?: string | null;
  providerSessionId?: string | null;
}) {
  const existing = await prisma.verification.findFirst({
    where: { providerReference: opts.providerReference },
  });
  if (!existing) return null;

  const banEvasion =
    opts.outcome === "VERIFIED_ADULT" &&
    (await isBanned(opts.identityHash ?? null));
  const outcome = banEvasion ? "REJECTED" : opts.outcome;

  const updated = await prisma.verification.update({
    where: { id: existing.id },
    data: {
      status: outcome as VerificationStatus,
      verifiedAt: outcome === "VERIFIED_ADULT" ? new Date() : null,
      verificationToken: null,
      ...(opts.identityHash ? { identityHash: opts.identityHash } : {}),
      ...(opts.providerSessionId
        ? { providerSessionId: opts.providerSessionId }
        : {}),
    },
  });

  if (banEvasion) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: existing.userId },
        data: {
          accountStatus: "SUSPENDED",
          statusReason: "This person was previously banned from OpenHeart.",
          statusChangedAt: new Date(),
          suspendedUntil: null,
        },
      }),
      prisma.modAction.create({
        data: {
          action: "ban_evasion_blocked",
          targetUserId: existing.userId,
          note: "Automatic: verified identity matches a permanent ban",
        },
      }),
    ]);
    await banUser(existing.userId, "Ban evasion");
    return { ...updated, banEvasion: true };
  }

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
  return { ...updated, banEvasion: false };
}

/**
 * The shared end of every provider webhook: record the outcome, have the
 * provider delete the ID images and personal data, then tell the member.
 */
export async function finishVerification(
  provider: VerificationProvider,
  decision: ProviderDecision,
  fetchImpl: typeof fetch = fetch,
) {
  const { identity } = decision;
  const result = await applyProviderDecision({
    providerReference: decision.reference,
    outcome: decision.outcome,
    underage: decision.underage,
    providerSessionId: decision.sessionId,
    identityHash:
      decision.outcome === "VERIFIED_ADULT"
        ? identityBanHash(identity.first, identity.last, identity.birthdate)
        : null,
  });
  if (!result) return null;

  if (await deleteProviderData(provider, decision.sessionId, fetchImpl)) {
    await prisma.verification.update({
      where: { id: result.id },
      data: { providerDataDeletedAt: new Date() },
    });
  }

  if (!decision.underage && !result.banEvasion) {
    const adult = result.status === VerificationStatus.VERIFIED_ADULT;
    await notify(result.userId, {
      type: "verification",
      title: adult ? "Your age is verified" : "We couldn't verify your age",
      body: adult
        ? "You can now activate your profile."
        : "You can try again from your profile. Contact support if you think this is a mistake.",
      link: "/onboarding?step=golive",
    });
  }
  return result;
}

const DELETE_RETRY_MS = 15 * 60 * 1000;

/**
 * Deletion can fail (provider down, rate limit); the jobs keep asking every
 * 15 minutes until the provider confirms. Veriff allows 5 deletions an hour.
 */
export async function retryProviderDeletions(
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
) {
  const pending = await prisma.verification.findMany({
    where: {
      providerSessionId: { not: null },
      providerDataDeletedAt: null,
      status: { not: VerificationStatus.PENDING },
      updatedAt: { lt: new Date(now.getTime() - DELETE_RETRY_MS) },
    },
    select: { id: true, provider: true, providerSessionId: true },
    orderBy: { updatedAt: "asc" },
    take: 5,
  });
  let deleted = 0;
  for (const v of pending) {
    const ok = await deleteProviderData(
      v.provider,
      v.providerSessionId,
      fetchImpl,
    );
    await prisma.verification.update({
      where: { id: v.id },
      data: ok ? { providerDataDeletedAt: now } : { updatedAt: now },
    });
    if (ok) deleted += 1;
  }
  return deleted;
}

/** Webhook/callback handler stub — marks adult verified without storing ID media. */
export async function completeAgeVerification(opts: {
  token: string;
  outcome: VerificationOutcome;
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
