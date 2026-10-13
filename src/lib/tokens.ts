import { createHash, randomBytes } from "crypto";
import { AuthTokenKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TTL_MS: Record<AuthTokenKind, number> = {
  EMAIL_VERIFY: 3 * 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Issues a new single-use token and voids any older unused ones of the same kind. */
export async function issueAuthToken(
  userId: string,
  kind: AuthTokenKind,
): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, kind, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        userId,
        kind,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + TTL_MS[kind]),
      },
    }),
  ]);
  return raw;
}

/** Marks the token used and returns its user id, or null if invalid, used, or expired. */
export async function consumeAuthToken(
  raw: string,
  kind: AuthTokenKind,
): Promise<string | null> {
  const tokenHash = hashToken(raw);
  const token = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!token || token.kind !== kind) return null;

  const claimed = await prisma.authToken.updateMany({
    where: { id: token.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return claimed.count === 1 ? token.userId : null;
}
