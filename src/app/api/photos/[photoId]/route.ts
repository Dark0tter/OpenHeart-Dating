import { NextResponse } from "next/server";
import { z } from "zod";
import { PhotoVisibility, ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isStaff, requireUser } from "@/lib/session";
import { allowedTiers, isRestricted } from "@/lib/content-policy";
import { viewablePhoto } from "@/lib/photos";
import { deleteObject, getObject } from "@/lib/storage";

type Ctx = { params: Promise<{ photoId: string }> };

/** Streams the image only if this viewer is allowed to see it. */
export async function GET(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { photoId } = await ctx.params;

  const adultAllowedHere = !isRestricted(await allowedTiers(user));
  const photo = await viewablePhoto(photoId, user, adultAllowedHere);
  if (!photo) return new NextResponse(null, { status: 404 });
  const ownPhoto = photo.profileId === user.profile?.id;
  const member =
    user.profile?.isActive && user.verification?.status === "VERIFIED_ADULT";
  if (!ownPhoto && !member && !isStaff(user.role)) {
    return new NextResponse(null, { status: 404 });
  }

  const size = new URL(req.url).searchParams.get("size");
  const key =
    size === "thumb" ? (photo.thumbKey ?? photo.storageKey) : photo.storageKey;
  const body = key ? await getObject(key) : null;
  if (!body) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control":
        photo.visibility === PhotoVisibility.PUBLIC
          ? "private, max-age=3600"
          : "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const patchSchema = z.object({
  visibility: z.nativeEnum(PhotoVisibility).optional(),
  isPrimary: z.literal(true).optional(),
  sortOrder: z.number().int().min(0).max(100).optional(),
});

async function ownPhoto(photoId: string, profileId: string) {
  return prisma.photo.findFirst({ where: { id: photoId, profileId } });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { photoId } = await ctx.params;
  const photo = await ownPhoto(photoId, user.profile.id);
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid change" }, { status: 400 });
  }
  const data = parsed.data;

  if (data.visibility === PhotoVisibility.ADULT) {
    if (isRestricted(await allowedTiers(user))) {
      return NextResponse.json(
        { error: "Adult photos can only be managed on the OpenHeart website." },
        { status: 403 },
      );
    }
    if (user.verification?.status !== "VERIFIED_ADULT") {
      return NextResponse.json(
        { error: "Verify your age before adding adult photos." },
        { status: 403 },
      );
    }
  }
  if (data.isPrimary && photo.visibility !== PhotoVisibility.PUBLIC) {
    return NextResponse.json(
      { error: "Your main photo must be visible to everyone." },
      { status: 400 },
    );
  }

  // Moving a photo to a more public album sends it back for review, since
  // what's acceptable in a private album isn't always fine in public.
  const widening =
    data.visibility === PhotoVisibility.PUBLIC &&
    photo.visibility !== PhotoVisibility.PUBLIC &&
    photo.status === ReviewStatus.APPROVED;

  await prisma.$transaction(async (tx) => {
    if (data.isPrimary) {
      await tx.photo.updateMany({
        where: { profileId: photo.profileId },
        data: { isPrimary: false },
      });
    }
    await tx.photo.update({
      where: { id: photo.id },
      data: {
        visibility: data.visibility,
        sortOrder: data.sortOrder,
        isPrimary:
          data.isPrimary ??
          (data.visibility && data.visibility !== PhotoVisibility.PUBLIC
            ? false
            : undefined),
        ...(widening ? { status: ReviewStatus.PENDING, reviewedAt: null } : {}),
      },
    });
  });

  return NextResponse.json({ ok: true, needsReview: widening });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (!user?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { photoId } = await ctx.params;
  const photo = await ownPhoto(photoId, user.profile.id);
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.photo.delete({ where: { id: photo.id } });
  await Promise.all([
    deleteObject(photo.storageKey),
    deleteObject(photo.thumbKey),
  ]);

  if (photo.isPrimary) {
    const next = await prisma.photo.findFirst({
      where: { profileId: photo.profileId, visibility: PhotoVisibility.PUBLIC },
      orderBy: { sortOrder: "asc" },
    });
    if (next) {
      await prisma.photo.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }
  return NextResponse.json({ ok: true });
}
