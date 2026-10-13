/**
 * Cloudflare Turnstile (free). Skipped when TURNSTILE_SECRET_KEY isn't set,
 * so local development works without it.
 */
export async function passesBotCheck(
  token: string | null | undefined,
  ip: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}

export const BOT_CHECK_FAILED =
  "We couldn't confirm you're a person. Please refresh the page and try again.";
