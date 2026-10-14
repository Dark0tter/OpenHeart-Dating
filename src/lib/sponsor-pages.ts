/**
 * Pages where the sponsor block may appear. Everywhere else (messages, room
 * chats, signup, safety, settings, other people's profiles) stays ad-free.
 */
const SPONSOR_EXACT = ["/rooms", "/profile"];
const SPONSOR_PREFIXES = ["/feed", "/search", "/events"];

export function sponsorAllowedOn(pathname: string): boolean {
  return (
    SPONSOR_EXACT.includes(pathname) ||
    SPONSOR_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  );
}
