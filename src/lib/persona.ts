import { createHmac, timingSafeEqual } from "crypto";

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Persona-Signature: "t=<unix>,v1=<hex>" — several v1 values may be present
 * (space separated) while a webhook secret is being rotated.
 */
export function personaSignatureValid(
  header: string | null,
  rawBody: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!header) return false;
  const t = /(?:^|,)\s*t=(\d+)/.exec(header)?.[1];
  const sigs = [...header.matchAll(/v1=([0-9a-f]+)/g)].map((m) => m[1]);
  if (!t || sigs.length === 0) return false;
  if (Math.abs(nowMs / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
