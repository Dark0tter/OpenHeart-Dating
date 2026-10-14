import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  PhotoVisibility,
  ReportPriority,
  ReportReason,
  ReportSource,
  ReviewStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { allowedTiers, isRestricted } from "@/lib/content-policy";
import { galleryFor, MAX_PHOTOS, photoSrc } from "@/lib/photos";
import { ImageError, processUpload } from "@/lib/images";
import { photoReviewMode, scanImage } from "@/lib/moderation/image-scan";
import { deleteObject, putObject } from "@/lib/storage";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";

/** GET /api/photos?userId=… — the photos this viewer may see. */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = new URL(req.url).searchParams.get("userId") ?? user.id;
  const adultAllowedHere = !isRestricted(await allowedTiers(user));
  return NextResponse.json(await galleryFor(userId, user, adultAllowedHere));
}

/** POST multipart: file, visibility. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (!user?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await limitFor("uploadsPerUser", user.id);
  if (!limited.ok) return tooManyRequests(limited);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Choose a photo to upload." },
      { status: 400 },
    );
  }

  const requested = String(form?.get("visibility") ?? "PUBLIC");
  const visibility = (Object.values(PhotoVisibility) as string[]).includes(
    requested,
  )
    ? (requested as PhotoVisibility)
    : PhotoVisibility.PUBLIC;

  if (visibility === PhotoVisibility.ADULT) {
    if (isRestricted(await allowedTiers(user))) {
      return NextResponse.json(
        { error: "Adult photos can only be added on the OpenHeart website." },
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

  const count = await prisma.photo.count({
    where: { profileId: user.profile.id },
  });
  if (count >= MAX_PHOTOS) {
    return NextResponse.json(
      { error: `You can have up to ${MAX_PHOTOS} photos. Delete one first.` },
      { status: 400 },
    );
  }

  const original = Buffer.from(await file.arrayBuffer());
  let processed;
  try {
    processed = await processUpload(original);
  } catch (e) {
    const message =
      e instanceof ImageError ? e.message : "That photo couldn't be processed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const scan = await scanImage(original, processed.contentHash);
  if (scan.verdict === "block") {
    const report = await prisma.report.create({
      data: {
        reportedUserId: user.id,
        source: ReportSource.AUTOMATED,
        reason: ReportReason.OTHER,
        priority: ReportPriority.HIGH,
        details: `Blocked photo upload: ${scan.reason}`,
        evidenceKey: `evidence/${randomUUID()}/upload`,
        legalHold: true,
      },
    });
    await putObject(
      report.evidenceKey!,
      original,
      file.type || "application/octet-stream",
    );
    return NextResponse.json(
      { error: "This photo can't be uploaded because it breaks our rules." },
      { status: 422 },
    );
  }

  const id = randomUUID();
  const storageKey = `photos/${user.id}/${id}.webp`;
  const thumbKey = `photos/${user.id}/${id}-thumb.webp`;
  await Promise.all([
    putObject(storageKey, processed.full, "image/webp"),
    putObject(thumbKey, processed.thumb, "image/webp"),
  ]);

  const autoApprove = scan.verdict === "clear" && photoReviewMode() === "post";
  let photo;
  try {
    photo = await prisma.photo.create({
      data: {
        id,
        profileId: user.profile.id,
        url: photoSrc(id),
        storageKey,
        thumbKey,
        contentHash: processed.contentHash,
        width: processed.width,
        height: processed.height,
        visibility,
        status: autoApprove ? ReviewStatus.APPROVED : ReviewStatus.PENDING,
        rejectionReason: scan.verdict === "review" ? scan.reason : null,
        isPrimary: count === 0,
        sortOrder: count,
      },
    });
  } catch (e) {
    await Promise.all([deleteObject(storageKey), deleteObject(thumbKey)]);
    throw e;
  }

  return NextResponse.json({
    photo: {
      id: photo.id,
      src: photoSrc(photo.id),
      thumb: photoSrc(photo.id, "thumb"),
      visibility: photo.visibility,
      status: photo.status,
      isPrimary: photo.isPrimary,
    },
    message: autoApprove
      ? "Photo added."
      : "Photo added. Others will see it once a moderator approves it, usually within a day.",
  });
}
