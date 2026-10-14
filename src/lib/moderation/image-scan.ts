import { prisma } from "@/lib/prisma";

export type ScanVerdict =
  | { verdict: "clear" }
  | { verdict: "review"; reason: string }
  | { verdict: "block"; reason: string };

/**
 * Automated checks on every uploaded image, before anyone else can see it.
 *
 * 1. Exact-match against files moderators permanently banned.
 * 2. If IMAGE_SCAN_URL is set, the image is POSTed to that endpoint, which
 *    must answer {"verdict":"clear"|"review"|"block","reason"?:string}. Point
 *    it at a hash-matching service (Microsoft PhotoDNA, Thorn Safer) and/or a
 *    nudity classifier. Cloudflare's free CSAM Scanning Tool also works at the
 *    CDN layer without any code here.
 */
export async function scanImage(
  original: Buffer,
  contentHash: string,
): Promise<ScanVerdict> {
  const banned = await prisma.blockedImageHash.findUnique({
    where: { hash: contentHash },
  });
  if (banned) return { verdict: "block", reason: banned.reason };

  const url = process.env.IMAGE_SCAN_URL;
  if (!url) return { verdict: "clear" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        ...(process.env.IMAGE_SCAN_TOKEN
          ? { Authorization: `Bearer ${process.env.IMAGE_SCAN_TOKEN}` }
          : {}),
      },
      body: new Uint8Array(original),
    });
    if (!res.ok) {
      return { verdict: "review", reason: `Scanner error ${res.status}` };
    }
    const data = (await res.json()) as { verdict?: string; reason?: string };
    if (data.verdict === "block") {
      return { verdict: "block", reason: data.reason ?? "Blocked by scanner" };
    }
    if (data.verdict === "review") {
      return { verdict: "review", reason: data.reason ?? "Flagged by scanner" };
    }
    return { verdict: "clear" };
  } catch {
    return { verdict: "review", reason: "Scanner unavailable" };
  }
}

/**
 * "pre": photos stay hidden until a moderator approves them (default in
 * production). "post": photos go live after automated checks and are
 * reviewed afterwards (default in development).
 */
export function photoReviewMode(): "pre" | "post" {
  const mode = process.env.PHOTO_REVIEW_MODE;
  if (mode === "pre" || mode === "post") return mode;
  return process.env.NODE_ENV === "production" ? "pre" : "post";
}
