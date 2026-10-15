/**
 * Settings the live site can't work properly without. Logged once at startup
 * so a missing one shows up plainly in the hosting logs.
 */
const REQUIRED: { keys: string[]; why: string }[] = [
  { keys: ["DATABASE_URL"], why: "nothing works without the database" },
  {
    keys: ["AUTH_SECRET", "NEXTAUTH_SECRET"],
    why: "nobody can sign in or sign up",
  },
  {
    keys: ["BAN_HASH_SECRET"],
    why: "permanent bans fall back to AUTH_SECRET and break if that ever changes",
  },
  { keys: ["APP_URL", "AUTH_URL"], why: "links in emails point to localhost" },
];

export function missingSettings(
  env: Record<string, string | undefined> = process.env,
) {
  return REQUIRED.filter((r) => !r.keys.some((k) => env[k]?.trim())).map(
    (r) => `${r.keys[0]} (${r.why})`,
  );
}
