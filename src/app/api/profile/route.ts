import { NextResponse } from "next/server";
import { z } from "zod";
import { KinkInterestLevel, Visibility } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { slugify } from "@/lib/constants/tags";
import { syncRoomInvites } from "@/lib/rooms";
import { allowedTiers, isRestricted } from "@/lib/content-policy";
import {
  enforceSolicitationPolicy,
  solicitationErrorBody,
} from "@/lib/moderation/solicitation";
import {
  MAX_PROMPT_ANSWER,
  MAX_PROMPTS,
  promptQuestion,
} from "@/lib/constants/prompts";
import { coarse, geocodeCity } from "@/lib/geocode";
import { profileCompleteness } from "@/lib/profile-completeness";

const updateSchema = z.object({
  displayName: z.string().min(2).max(40).optional(),
  bio: z.string().max(2000).optional().nullable(),
  pronouns: z.string().max(40).optional().nullable(),
  visibility: z.nativeEnum(Visibility).optional(),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(80).optional().nullable(),
  country: z.string().max(80).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  radiusKm: z.number().int().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
  identityTagIds: z.array(z.string()).optional(),
  orientationTagIds: z.array(z.string()).optional(),
  goalTagIds: z.array(z.string()).optional(),
  relationshipStyleTagIds: z.array(z.string()).optional(),
  bodyTagIds: z.array(z.string()).optional(),
  ethnicityTagIds: z.array(z.string()).optional(),
  accessibilityTagIds: z.array(z.string()).optional(),
  seekingIdentityTagIds: z.array(z.string()).optional(),
  seekingOrientationTagIds: z.array(z.string()).optional(),
  customIdentity: z.string().max(40).optional(),
  customOrientation: z.string().max(40).optional(),
  kinks: z
    .array(
      z.object({
        kinkId: z.string(),
        level: z.nativeEnum(KinkInterestLevel),
      }),
    )
    .optional(),
  prompts: z
    .array(
      z.object({
        promptId: z.string().refine((id) => promptQuestion(id) !== null),
        answer: z.string().trim().min(1).max(MAX_PROMPT_ANSWER),
      }),
    )
    .max(MAX_PROMPTS)
    .optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tiers = await allowedTiers(user);
  const restricted = isRestricted(tiers);

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    include: {
      identityTags: { include: { tag: true } },
      orientationTags: { include: { tag: true } },
      goalTags: { include: { tag: true } },
      relationshipStyleTags: { include: { tag: true } },
      bodyTags: { include: { tag: true } },
      ethnicityTags: { include: { tag: true } },
      accessibilityTags: { include: { tag: true } },
      kinks: {
        where: { kink: { tier: { in: tiers } } },
        include: { kink: { include: { category: true } } },
      },
      seekingIdentityTags: { include: { tag: true } },
      seekingOrientationTags: { include: { tag: true } },
      photos: {
        where: restricted ? { visibility: { not: "ADULT" } } : {},
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      },
      prompts: { orderBy: { sortOrder: "asc" } },
    },
  });

  const completeness = profile
    ? profileCompleteness({
        publicPhotos: profile.photos.filter(
          (p) => p.visibility === "PUBLIC" && p.status === "APPROVED",
        ).length,
        bio: profile.bio,
        pronouns: profile.pronouns,
        identityCount: profile.identityTags.length,
        orientationCount: profile.orientationTags.length,
        goalCount: profile.goalTags.length,
        promptCount: profile.prompts.length,
        hasLocation: profile.latitude != null,
        emailVerified: Boolean(user.emailVerified),
        ageVerified: user.verification?.status === "VERIFIED_ADULT",
        photoVerified: Boolean(user.photoVerifiedAt),
      })
    : null;

  return NextResponse.json({
    profile,
    verification: user.verification,
    dateOfBirth: user.dateOfBirth,
    emailVerified: Boolean(user.emailVerified),
    photoVerified: Boolean(user.photoVerifiedAt),
    contentRestricted: restricted,
    completeness,
  });
}

export async function PATCH(req: Request) {
  const user = await requireUser();
  if (!user?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const profileId = user.profile.id;
  const tiers = await allowedTiers(user);

  const solicitation = await enforceSolicitationPolicy({
    userId: user.id,
    context: "profile",
    fields: {
      displayName: data.displayName,
      bio: data.bio,
      pronouns: data.pronouns,
      city: data.city,
      customIdentity: data.customIdentity,
      customOrientation: data.customOrientation,
      prompts: data.prompts?.map((p) => p.answer).join("\n"),
    },
  });
  if (solicitation.blocked) {
    return NextResponse.json(solicitationErrorBody(solicitation.labels), {
      status: 422,
    });
  }

  // Activate only when age-verified (adult content / full access gate)
  if (data.isActive === true) {
    if (!user.emailVerified) {
      return NextResponse.json(
        { error: "Please confirm your email before activating your profile." },
        { status: 403 },
      );
    }
    if (user.verification?.status !== "VERIFIED_ADULT") {
      return NextResponse.json(
        {
          error: "Age verification required before activating your profile.",
        },
        { status: 403 },
      );
    }
  }

  // Browser coordinates are rounded to ~1 km; a typed city is looked up once.
  if (data.latitude != null) data.latitude = coarse(data.latitude);
  if (data.longitude != null) data.longitude = coarse(data.longitude);
  const cityChanged =
    data.city !== undefined &&
    (data.city !== user.profile.city ||
      data.state !== user.profile.state ||
      data.country !== user.profile.country);
  if (cityChanged && data.latitude === undefined) {
    const found = data.city ? await geocodeCity(data) : null;
    data.latitude = found?.latitude ?? null;
    data.longitude = found?.longitude ?? null;
  }

  await prisma.$transaction(async (tx) => {
    if (data.prompts) {
      await tx.profilePrompt.deleteMany({ where: { profileId } });
      await tx.profilePrompt.createMany({
        data: data.prompts.map((p, i) => ({
          profileId,
          promptId: p.promptId,
          answer: p.answer,
          sortOrder: i,
        })),
        skipDuplicates: true,
      });
    }

    await tx.profile.update({
      where: { id: profileId },
      data: {
        displayName: data.displayName,
        bio: data.bio,
        pronouns: data.pronouns,
        visibility: data.visibility,
        city: data.city,
        state: data.state,
        country: data.country,
        latitude: data.latitude,
        longitude: data.longitude,
        radiusKm: data.radiusKm,
        isActive: data.isActive,
      },
    });

    if (data.customIdentity?.trim()) {
      const label = data.customIdentity.trim();
      const tag = await tx.identityTag.upsert({
        where: { slug: slugify(`custom-${label}`) },
        create: {
          slug: slugify(`custom-${label}`),
          label,
          isCustom: true,
        },
        update: {},
      });
      data.identityTagIds = [...(data.identityTagIds ?? []), tag.id];
    }

    if (data.customOrientation?.trim()) {
      const label = data.customOrientation.trim();
      const tag = await tx.orientationTag.upsert({
        where: { slug: slugify(`custom-${label}`) },
        create: {
          slug: slugify(`custom-${label}`),
          label,
          isCustom: true,
        },
        update: {},
      });
      data.orientationTagIds = [...(data.orientationTagIds ?? []), tag.id];
    }

    if (data.identityTagIds) {
      await tx.profileIdentityTag.deleteMany({ where: { profileId } });
      await tx.profileIdentityTag.createMany({
        data: [...new Set(data.identityTagIds)].map((tagId) => ({
          profileId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    if (data.orientationTagIds) {
      await tx.profileOrientationTag.deleteMany({ where: { profileId } });
      await tx.profileOrientationTag.createMany({
        data: [...new Set(data.orientationTagIds)].map((tagId) => ({
          profileId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    if (data.goalTagIds) {
      await tx.profileGoalTag.deleteMany({ where: { profileId } });
      await tx.profileGoalTag.createMany({
        data: data.goalTagIds.map((tagId) => ({ profileId, tagId })),
        skipDuplicates: true,
      });
    }

    if (data.relationshipStyleTagIds) {
      await tx.profileRelationshipStyleTag.deleteMany({ where: { profileId } });
      await tx.profileRelationshipStyleTag.createMany({
        data: [...new Set(data.relationshipStyleTagIds)].map((tagId) => ({
          profileId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    if (data.bodyTagIds) {
      await tx.profileBodyTag.deleteMany({ where: { profileId } });
      await tx.profileBodyTag.createMany({
        data: data.bodyTagIds.map((tagId) => ({ profileId, tagId })),
        skipDuplicates: true,
      });
    }

    if (data.ethnicityTagIds) {
      await tx.profileEthnicityTag.deleteMany({ where: { profileId } });
      await tx.profileEthnicityTag.createMany({
        data: data.ethnicityTagIds.map((tagId) => ({ profileId, tagId })),
        skipDuplicates: true,
      });
    }

    if (data.accessibilityTagIds) {
      await tx.profileAccessibilityTag.deleteMany({ where: { profileId } });
      await tx.profileAccessibilityTag.createMany({
        data: data.accessibilityTagIds.map((tagId) => ({ profileId, tagId })),
        skipDuplicates: true,
      });
    }

    if (data.seekingIdentityTagIds) {
      await tx.seekingIdentityTag.deleteMany({ where: { profileId } });
      await tx.seekingIdentityTag.createMany({
        data: data.seekingIdentityTagIds.map((tagId) => ({
          profileId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    if (data.seekingOrientationTagIds) {
      await tx.seekingOrientationTag.deleteMany({ where: { profileId } });
      await tx.seekingOrientationTag.createMany({
        data: data.seekingOrientationTagIds.map((tagId) => ({
          profileId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }

    if (data.kinks) {
      // Only replace kinks this client can see; ones hidden from the app stay.
      await tx.profileKink.deleteMany({
        where: { profileId, kink: { tier: { in: tiers } } },
      });
      const allowed = new Set(
        (
          await tx.kink.findMany({
            where: {
              id: { in: data.kinks.map((k) => k.kinkId) },
              tier: { in: tiers },
            },
            select: { id: true },
          })
        ).map((k) => k.id),
      );
      await tx.profileKink.createMany({
        data: data.kinks
          .filter((k) => allowed.has(k.kinkId))
          .map((k) => ({
            profileId,
            kinkId: k.kinkId,
            level: k.level,
          })),
        skipDuplicates: true,
      });
    }
  });

  const newRoomInvites = await syncRoomInvites(user.id);

  return NextResponse.json({ ok: true, newRoomInvites });
}
