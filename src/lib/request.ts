import { headers } from "next/headers";

/** First hop in X-Forwarded-For (set by DigitalOcean / Cloudflare), else "unknown". */
export async function clientIp(req?: Request): Promise<string> {
  const h = req?.headers ?? (await headers());
  const forwarded =
    h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0];
  return forwarded?.trim() || h.get("x-real-ip") || "unknown";
}

/** Absolute base URL for links in emails. */
export function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}
