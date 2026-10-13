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
    },
  });

  return NextResponse.json({
    profile,
    verification: user.verification,
    dateOfBirth: user.dateOfBirth,
    contentRestricted: restricted,
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
    },
  });
  if (solicitation.blocked) {
    return NextResponse.json(solicitationErrorBody(solicitation.labels), {
      status: 422,
    });
  }

  // Activate only when age-verified (adult content / full access gate)
  if (data.isActive === true) {
    if (user.verification?.status !== "VERIFIED_ADULT") {
      return NextResponse.json(
        {
          error: "Age verification required before activating your profile.",
        },
        { status: 403 },
      );
    }
  }

  await prisma.$transaction(async (tx) => {
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
