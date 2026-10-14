import {
  ConsentScope,
  PhotoVisibility,
  ReviewStatus,
  type Photo,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/session";
import { isBlockedEitherWay } from "@/lib/safety";
import { assertProfileViewable } from "@/lib/discovery";
import { orderedPair } from "@/lib/utils";

export const MAX_PHOTOS = 12;

export const VISIBILITY_LABELS: Record<PhotoVisibility, string> = {
  PUBLIC: "Everyone",
  MATCH_ONLY: "Matches only",
  PRIVATE: "Private album (by request)",
  ADULT: "Adult album (by request, website only)",
};

export function photoSrc(photoId: string, size: "thumb" | "full" = "full") {
  return `/api/photos/${photoId}${size === "thumb" ? "?size=thumb" : ""}`;
}

type Viewer = {
  id: string;
  role?: string | null;
  verification?: { status: string } | null;
};

export type AccessContext = {
  isOwner: boolean;
  isStaff: boolean;
  matched: boolean;
  privateGrant: boolean;
  adultGrant: boolean;
  viewerVerifiedAdult: boolean;
  /** False inside the mobile apps: adult photos are website-only. */
  adultAllowedHere: boolean;
};

export async function accessContext(
  viewer: Viewer,
  ownerUserId: string,
  adultAllowedHere: boolean,
): Promise<AccessContext> {
  const isOwner = viewer.id === ownerUserId;
  const staff = isStaff(viewer.role as never);
  if (isOwner || staff) {
    return {
      isOwner,
      isStaff: staff,
      matched: true,
      privateGrant: true,
      adultGrant: true,
      viewerVerifiedAdult: true,
      adultAllowedHere,
    };
  }

  const [a, b] = orderedPair(viewer.id, ownerUserId);
  const [match, grants] = await Promise.all([
    prisma.match.findFirst({
      where: { userAId: a, userBId: b, unmatchedAt: null },
      select: { id: true },
    }),
    prisma.consentGrant.findMany({
      where: { granterId: ownerUserId, viewerId: viewer.id, revokedAt: null },
      select: { scope: true },
    }),
  ]);
  const scopes = new Set(grants.map((g) => g.scope));

  return {
    isOwner,
    isStaff: false,
    matched: Boolean(match),
    privateGrant: scopes.has(ConsentScope.PRIVATE_ALBUM),
    adultGrant: scopes.has(ConsentScope.ADULT_ALBUM),
    viewerVerifiedAdult: viewer.verification?.status === "VERIFIED_ADULT",
    adultAllowedHere,
  };
}

export function canSeePhoto(
  photo: Pick<Photo, "visibility" | "status">,
  ctx: AccessContext,
): boolean {
  if (photo.visibility === PhotoVisibility.ADULT && !ctx.adultAllowedHere) {
    return false;
  }
  if (ctx.isOwner || ctx.isStaff) return true;
  if (photo.status !== ReviewStatus.APPROVED) return false;

  switch (photo.visibility) {
    case PhotoVisibility.PUBLIC:
      return true;
    case PhotoVisibility.MATCH_ONLY:
      return ctx.matched;
    case PhotoVisibility.PRIVATE:
      return ctx.privateGrant;
    case PhotoVisibility.ADULT:
      return ctx.adultGrant && ctx.viewerVerifiedAdult;
  }
}

/** Full permission check for serving one image. */
export async function viewablePhoto(
  photoId: string,
  viewer: Viewer,
  adultAllowedHere: boolean,
) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: { profile: { select: { userId: true } } },
  });
  if (!photo) return null;
  const ownerUserId = photo.profile.userId;

  if (viewer.id !== ownerUserId && !isStaff(viewer.role as never)) {
    if (await isBlockedEitherWay(viewer.id, ownerUserId)) return null;
    const profile = await assertProfileViewable({
      profileUserId: ownerUserId,
      viewerUserId: viewer.id,
    });
    if (!profile) return null;
  }

  const ctx = await accessContext(viewer, ownerUserId, adultAllowedHere);
  return canSeePhoto(photo, ctx) ? photo : null;
}

/** What a viewer sees of someone's photos, plus counts of the locked albums. */
export async function galleryFor(
  ownerUserId: string,
  viewer: Viewer,
  adultAllowedHere: boolean,
) {
  const [photos, ctx] = await Promise.all([
    prisma.photo.findMany({
      where: { profile: { userId: ownerUserId } },
      orderBy: [
        { isPrimary: "desc" },
        { sortOrder: "asc" },
        { createdAt: "asc" },
      ],
    }),
    accessContext(viewer, ownerUserId, adultAllowedHere),
  ]);

  const visible = photos.filter((p) => canSeePhoto(p, ctx));
  const approved = photos.filter((p) => p.status === ReviewStatus.APPROVED);
  const lockedPrivate = ctx.privateGrant
    ? 0
    : approved.filter((p) => p.visibility === PhotoVisibility.PRIVATE).length;
  const lockedAdult =
    !adultAllowedHere || (ctx.adultGrant && ctx.viewerVerifiedAdult)
      ? 0
      : approved.filter((p) => p.visibility === PhotoVisibility.ADULT).length;

  return {
    photos: visible.map((p) => ({
      id: p.id,
      src: photoSrc(p.id),
      thumb: photoSrc(p.id, "thumb"),
      visibility: p.visibility,
      isPrimary: p.isPrimary,
      ...(ctx.isOwner
        ? { status: p.status, rejectionReason: p.rejectionReason }
        : {}),
    })),
    lockedPrivate,
    lockedAdult,
  };
}

/** Primary public, approved photo for cards and lists. */
export function primaryPhotoWhere() {
  return {
    visibility: PhotoVisibility.PUBLIC,
    status: ReviewStatus.APPROVED,
  } as const;
}
