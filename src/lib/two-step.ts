import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Two-step sign-in with an authenticator app (RFC 6238 TOTP: 6 digits, 30
 * seconds, SHA-1, the settings every authenticator app supports), plus
 * one-time recovery codes. Secrets are stored encrypted with a key derived
 * from AUTH_SECRET; changing AUTH_SECRET means everyone re-does setup
 * (`npm run two-step:reset`).
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
const ISSUER = "OpenHeart";
const RECOVERY_CODE_COUNT = 10;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotp(key: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0xf;
  const bin = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function currentStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/**
 * The step a code matches (allowing one step of clock drift either way), or
 * null. Steps at or before `lastStep` are refused so a code works only once.
 */
export function matchTotp(
  secretB32: string,
  code: string,
  opts: { nowMs?: number; lastStep?: number | null } = {},
): number | null {
  const digits = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const key = base32Decode(secretB32);
  const now = currentStep(opts.nowMs);
  for (const step of [now - 1, now, now + 1]) {
    if (opts.lastStep != null && step <= opts.lastStep) continue;
    const expected = Buffer.from(hotp(key, step));
    if (timingSafeEqual(expected, Buffer.from(digits))) return step;
  }
  return null;
}

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHash("sha256").update(`two-step:${secret}`).digest();
}

export function sealSecret(secretB32: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([
    cipher.update(secretB32, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64url"))
    .join(".");
}

export function openSecret(sealed: string): string | null {
  try {
    const [iv, tag, data] = sealed
      .split(".")
      .map((p) => Buffer.from(p, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
}

export function otpauthUrl(secretB32: string, email: string): string {
  const label = encodeURIComponent(`${ISSUER}:${email}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${ISSUER}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

function normalizeRecovery(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(normalizeRecovery(code)).digest("hex");
}

/** Ten codes like "k7m2-9xq4", shown once. Only their hashes are stored. */
export function newRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const bytes = randomBytes(8);
    const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
  return { codes, hashes: codes.map(hashRecoveryCode) };
}

/** Starts (or restarts) setup. Two-step isn't on until confirmTwoStep. */
export async function beginTwoStep(userId: string, email: string) {
  const secret = base32Encode(randomBytes(20));
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: sealSecret(secret),
      totpEnabledAt: null,
      totpLastStep: null,
    },
  });
  return { secret, url: otpauthUrl(secret, email) };
}

/**
 * Turns two-step on once the member proves their app works. Signs out every
 * other session, since those didn't pass the second step.
 */
export async function confirmTwoStep(
  userId: string,
  code: string,
  nowMs = Date.now(),
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpEnabledAt: true },
  });
  if (!user?.totpSecret || user.totpEnabledAt) return null;
  const secret = openSecret(user.totpSecret);
  const step = secret ? matchTotp(secret, code, { nowMs }) : null;
  if (step == null) return null;
  const { codes, hashes } = newRecoveryCodes();
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpEnabledAt: new Date(nowMs),
      totpLastStep: step,
      recoveryCodes: hashes,
      sessionVersion: { increment: 1 },
    },
  });
  return codes;
}

/**
 * Checks an authenticator or recovery code for someone with two-step on, and
 * uses it up. Recovery codes work once each.
 */
export async function verifySecondStep(
  userId: string,
  code: string,
  nowMs = Date.now(),
): Promise<"totp" | "recovery" | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      totpSecret: true,
      totpEnabledAt: true,
      totpLastStep: true,
      recoveryCodes: true,
    },
  });
  if (!user?.totpSecret || !user.totpEnabledAt) return null;

  const secret = openSecret(user.totpSecret);
  const step = secret
    ? matchTotp(secret, code, { nowMs, lastStep: user.totpLastStep })
    : null;
  if (step != null) {
    const updated = await prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }],
      },
      data: { totpLastStep: step },
    });
    return updated.count === 1 ? "totp" : null;
  }

  const hash = hashRecoveryCode(code);
  if (
    normalizeRecovery(code).length !== 8 ||
    !user.recoveryCodes.includes(hash)
  ) {
    return null;
  }
  const removed = await prisma.$executeRaw`
    UPDATE "User" SET "recoveryCodes" = array_remove("recoveryCodes", ${hash})
    WHERE "id" = ${userId} AND ${hash} = ANY("recoveryCodes")`;
  return removed === 1 ? "recovery" : null;
}

export async function regenerateRecoveryCodes(userId: string) {
  const { codes, hashes } = newRecoveryCodes();
  await prisma.user.update({
    where: { id: userId },
    data: { recoveryCodes: hashes },
  });
  return codes;
}

export async function disableTwoStep(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totpSecret: null,
      totpEnabledAt: null,
      totpLastStep: null,
      recoveryCodes: [],
      sessionVersion: { increment: 1 },
    },
  });
}
