import { headers } from "next/headers";
import { ContentTier, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * The iOS and Android apps are the same web app in a native shell. The shell
 * must append this token to its WebView user agent (Capacitor:
 * `appendUserAgent`) and send it as the `x-openheart-client: app` header on
 * any direct API calls. Both platforms get the same, stricter policy.
 *
 * Spoofing only ever removes content, so the check needs no secret.
 */
export const APP_USER_AGENT_TOKEN = "OpenHeartApp";
export const APP_CLIENT_HEADER = "x-openheart-client";

const ALL_TIERS: ContentTier[] = [
  ContentTier.STANDARD,
  ContentTier.ADULT_TEXT,
  ContentTier.WEB_ONLY,
];

export async function isAppRequest(): Promise<boolean> {
  const h = await headers();
  return (
    h.get(APP_CLIENT_HEADER) === "app" ||
    (h.get("user-agent") ?? "").includes(APP_USER_AGENT_TOKEN)
  );
}

type Viewer = {
  appAdultContent: boolean;
  verification?: { status: string } | null;
} | null;

/** Content tiers the current request may see. */
export async function allowedTiers(viewer: Viewer): Promise<ContentTier[]> {
  if (!(await isAppRequest())) return ALL_TIERS;
  const optedIn =
    viewer?.appAdultContent === true &&
    viewer.verification?.status === "VERIFIED_ADULT";
  return optedIn
    ? [ContentTier.STANDARD, ContentTier.ADULT_TEXT]
    : [ContentTier.STANDARD];
}

export function isRestricted(tiers: ContentTier[]): boolean {
  return !tiers.includes(ContentTier.WEB_ONLY);
}

/** Rooms tied to a kink category inherit the category's tier. */
export function roomTierWhere(tiers: ContentTier[]): Prisma.ChatRoomWhereInput {
  return {
    OR: [{ kinkCategoryId: null }, { kinkCategory: { tier: { in: tiers } } }],
  };
}

export async function roomAllowed(
  roomId: string,
  tiers: ContentTier[],
): Promise<boolean> {
  if (!isRestricted(tiers)) return true;
  const room = await prisma.chatRoom.findFirst({
    where: { id: roomId, ...roomTierWhere(tiers) },
    select: { id: true },
  });
  return room !== null;
}

export const WEB_ONLY_ERROR =
  "This is only available on the OpenHeart website.";
