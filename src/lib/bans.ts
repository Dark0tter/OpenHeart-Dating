import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Permanent bans keep only keyed hashes: one of the email, and one of the
 * verified name + birthdate from the age check. That stops someone rejoining
 * with the same email or verifying a new account, without keeping who they
 * were. Changing BAN_HASH_SECRET after launch invalidates existing bans.
 */
function secret(): string {
  return (
    process.env.BAN_HASH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "openheart-dev-only"
  );
}

function keyed(kind: string, value: string): string {
  return createHmac("sha256", secret())
    .update(`${kind}:${value}`)
    .digest("hex");
}

export function normalizeEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  const base = local.split("+")[0];
  return gmail ? `${base.replace(/\./g, "")}@gmail.com` : `${base}@${domain}`;
}

export function emailBanHash(email: string): string {
  return keyed("email", normalizeEmail(email));
}

/** Null when the provider didn't give us enough to identify the person. */
export function identityBanHash(
  first: string | null,
  last: string | null,
  birthdate: string | null,
): string | null {
  const clean = (s: string | null) =>
    (s ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  const f = clean(first);
  const l = clean(last);
  const d = /^\d{4}-\d{2}-\d{2}/.exec(birthdate ?? "")?.[0];
  if (!f || !l || !d) return null;
  return keyed("identity", `${f}|${l}|${d}`);
}

export async function banUser(userId: string, reason: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, verification: { select: { identityHash: true } } },
  });
  if (!user) return;
  const entries = [
    { hash: emailBanHash(user.email), kind: "email" },
    ...(user.verification?.identityHash
      ? [{ hash: user.verification.identityHash, kind: "identity" }]
      : []),
  ];
  for (const e of entries) {
    await prisma.bannedIdentity.upsert({
      where: { hash: e.hash },
      create: { ...e, userId, reason },
      update: { userId, reason },
    });
  }
}

/** Lifting a ban (e.g. a successful appeal) removes its hashes. */
export async function unbanUser(userId: string) {
  await prisma.bannedIdentity.deleteMany({ where: { userId } });
}

export async function isBanned(hash: string | null): Promise<boolean> {
  if (!hash) return false;
  const row = await prisma.bannedIdentity.findUnique({ where: { hash } });
  return Boolean(row);
}
