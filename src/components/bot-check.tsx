"use client";

import Script from "next/script";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Renders the Turnstile widget inside a form. It adds a hidden
 * `cf-turnstile-response` field that the server checks. Renders nothing when
 * no site key is configured.
 */
export function BotCheck() {
  if (!SITE_KEY) return null;
  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
      />
      <div
        className="cf-turnstile"
        data-sitekey={SITE_KEY}
        data-theme="auto"
        data-size="flexible"
      />
    </>
  );
}

export function botToken(fd: FormData): string | undefined {
  const v = fd.get("cf-turnstile-response");
  return typeof v === "string" && v ? v : undefined;
}
