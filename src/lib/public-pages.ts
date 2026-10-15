/**
 * The only pages search engines may index. Everything else (profiles,
 * messages, staff tools) is sent with noindex by the middleware.
 */
export const PUBLIC_PAGES = [
  "/",
  "/register",
  "/advertise",
  "/waitlist",
  "/safety",
  "/guidelines",
  "/support",
  "/terms",
  "/privacy",
  "/child-safety",
] as const;

export function isIndexable(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return (PUBLIC_PAGES as readonly string[]).includes(path);
}
