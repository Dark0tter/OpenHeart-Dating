import { NextResponse } from "next/server";
import { randomInt, randomUUID } from "crypto";
import { ReviewStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ImageError, processUpload } from "@/lib/images";
import { putObject } from "@/lib/storage";
import { limitFor, tooManyRequests } from "@/lib/rate-limit";
import { SELFIE_GESTURES } from "@/lib/constants/selfie";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const latest = await prisma.selfieVerification.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { status: true, reviewNote: true, createdAt: true },
  });
  return NextResponse.json({
    photoVerified: Boolean(user.photoVerifiedAt),
    latest,
    gesture: SELFIE_GESTURES[randomInt(SELFIE_GESTURES.length)],
  });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await limitFor("uploadsPerUser", user.id);
  if (!limited.ok) return tooManyRequests(limited);

  if (user.photoVerifiedAt) {
    return NextResponse.json(
      { error: "Your photos are already verified." },
      { status: 400 },
    );
  }
  const [pending, photoCount] = await Promise.all([
    prisma.selfieVerification.count({
      where: { userId: user.id, status: ReviewStatus.PENDING },
    }),
    prisma.photo.count({
      where: { profileId: user.profile.id, visibility: "PUBLIC" },
    }),
  ]);
  if (pending > 0) {
    return NextResponse.json(
      { error: "Your selfie is already waiting for review." },
      { status: 400 },
    );
  }
  if (photoCount === 0) {
    return NextResponse.json(
      {
        error:
          "Add at least one public profile photo first, so we have something to compare.",
      },
      { status: 400 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const gesture = String(form?.get("gesture") ?? "");
  if (!(file instanceof File) || !SELFIE_GESTURES.includes(gesture)) {
    return NextResponse.json(
      { error: "Take a selfie doing the pose shown." },
      { status: 400 },
    );
  }

  let processed;
  try {
    processed = await processUpload(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    const message =
      e instanceof ImageError ? e.message : "That photo couldn't be processed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const id = randomUUID();
  const storageKey = `selfies/${user.id}/${id}.webp`;
  await putObject(storageKey, processed.full, "image/webp");
  await prisma.selfieVerification.create({
    data: { id, userId: user.id, storageKey, gesture },
  });

  return NextResponse.json({
    ok: true,
    message:
      "Thanks! A moderator will compare it with your profile photos, usually within a day. The selfie is deleted right after review.",
  });
}
