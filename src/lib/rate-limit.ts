import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

/**
 * Counts one attempt for `name:id` in a fixed window and reports whether the
 * caller is still under `limit`. Stored in Postgres so every server instance
 * shares the same counts.
 */
export async function rateLimit(
  name: string,
  id: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const windowStart = new Date(now - (now % windowMs));
  const key = `${name}:${id}`;

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStart" = EXCLUDED."windowStart"
          THEN "RateLimitBucket"."count" + 1
        ELSE 1
      END,
      "windowStart" = EXCLUDED."windowStart"
    RETURNING "count"
  `;

  const count = Number(rows[0]?.count ?? 1);
  const retryAfterSeconds = Math.ceil(
    (windowStart.getTime() + windowMs - now) / 1000,
  );
  return { ok: count <= limit, retryAfterSeconds };
}

export function tooManyRequests(
  result: RateLimitResult,
  message = "Too many attempts. Please wait a few minutes and try again.",
) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}

/** Limits used across the site, in one place so they're easy to tune. */
export const LIMITS = {
  loginPerEmail: { limit: 10, windowSeconds: 15 * 60 },
  loginPerIp: { limit: 50, windowSeconds: 15 * 60 },
  registerPerIp: { limit: 5, windowSeconds: 60 * 60 },
  emailPerUser: { limit: 5, windowSeconds: 60 * 60 },
  forgotPerIp: { limit: 10, windowSeconds: 60 * 60 },
  likesPerUser: { limit: 200, windowSeconds: 24 * 60 * 60 },
  messagesPerUser: { limit: 60, windowSeconds: 60 },
  messageRequestsPerUser: { limit: 20, windowSeconds: 24 * 60 * 60 },
  postsPerUser: { limit: 20, windowSeconds: 60 * 60 },
  reportsPerUser: { limit: 20, windowSeconds: 24 * 60 * 60 },
  uploadsPerUser: { limit: 30, windowSeconds: 60 * 60 },
  supportPerIp: { limit: 10, windowSeconds: 60 * 60 },
  appealsPerUser: { limit: 3, windowSeconds: 24 * 60 * 60 },
  eventsPerUser: { limit: 5, windowSeconds: 24 * 60 * 60 },
  exportsPerUser: { limit: 3, windowSeconds: 24 * 60 * 60 },
  sponsorEventsPerUser: { limit: 200, windowSeconds: 24 * 60 * 60 },
  callsPerUser: { limit: 20, windowSeconds: 60 * 60 },
} as const;

export function limitFor(
  name: keyof typeof LIMITS,
  id: string,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = LIMITS[name];
  return rateLimit(name, id, limit, windowSeconds);
}
