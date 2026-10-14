import { distanceKm } from "@/lib/utils";
import { clashPenalty, type KinkLevel as Level } from "@/lib/limits";

export type RankProfile = {
  identityIds: string[];
  seekingIdentityIds: string[];
  orientationIds: string[];
  seekingOrientationIds: string[];
  goalIds: string[];
  styleIds: string[];
  kinks: { kinkId: string; level: Level }[];
  latitude: number | null;
  longitude: number | null;
  lastActiveAt: Date;
  publicPhotos: number;
  bioLength: number;
  promptCount: number;
  photoVerified: boolean;
  ageVerified: boolean;
};

const KINK_WEIGHT: Partial<Record<Level, number>> = {
  FAVORITE: 3,
  INTERESTED: 2,
  CURIOUS: 1,
};

function overlap(a: string[], b: string[]): number {
  const set = new Set(a);
  return b.filter((x) => set.has(x)).length;
}

function wants(seeker: RankProfile, other: RankProfile): boolean {
  const identityOk =
    seeker.seekingIdentityIds.length === 0 ||
    overlap(seeker.seekingIdentityIds, other.identityIds) > 0;
  const orientationOk =
    seeker.seekingOrientationIds.length === 0 ||
    overlap(seeker.seekingOrientationIds, other.orientationIds) > 0;
  return identityOk && orientationOk;
}

export type ScoreBreakdown = {
  total: number;
  mutualFit: number;
  sharedGoals: number;
  kinks: number;
  limitsClash: number;
  distance: number;
  activity: number;
  profileQuality: number;
  trust: number;
  /** Kinks where one person's hard limit is something the other is into. */
  hardClashes: number;
};

/**
 * How well a candidate suits the viewer. Every factor is something both
 * people chose to put on their profile; nothing comes from tracking.
 */
export function scoreMatch(
  viewer: RankProfile,
  candidate: RankProfile,
  now = Date.now(),
): ScoreBreakdown {
  // Seeking works both ways: an empty seeking list means "open to anyone".
  const viewerWants = wants(viewer, candidate);
  const candidateWants = wants(candidate, viewer);
  const mutualFit = (viewerWants ? 3 : -3) + (candidateWants ? 3 : -3);

  const sharedGoals =
    Math.min(overlap(viewer.goalIds, candidate.goalIds), 2) * 1.5 +
    Math.min(overlap(viewer.styleIds, candidate.styleIds), 2);

  const theirs = new Map(candidate.kinks.map((k) => [k.kinkId, k.level]));
  let kinkRaw = 0;
  let penalty = 0;
  let hardClashes = 0;
  for (const mine of viewer.kinks) {
    const other = theirs.get(mine.kinkId);
    if (!other) continue;
    const a = KINK_WEIGHT[mine.level];
    const b = KINK_WEIGHT[other];
    if (a && b) kinkRaw += Math.min(a, b);
    const p = clashPenalty(mine.level, other);
    penalty += p;
    if (p > 0 && (mine.level === "HARD_LIMIT" || other === "HARD_LIMIT")) {
      hardClashes += 1;
    }
  }
  const kinks = Math.min(kinkRaw, 18) / 3;
  const limitsClash = -Math.min(penalty, 9);

  let distance = 0;
  if (
    viewer.latitude != null &&
    viewer.longitude != null &&
    candidate.latitude != null &&
    candidate.longitude != null
  ) {
    const d = distanceKm(
      viewer.latitude,
      viewer.longitude,
      candidate.latitude,
      candidate.longitude,
    );
    distance = 3 * Math.exp(-d / 50);
  }

  const days = (now - candidate.lastActiveAt.getTime()) / 86_400_000;
  const activity = days < 1 ? 2 : days < 7 ? 1 : days < 30 ? 0 : -1;

  const profileQuality =
    (candidate.publicPhotos > 0 ? 1 : -1) +
    (candidate.bioLength >= 60 ? 0.5 : 0) +
    (candidate.promptCount > 0 ? 0.5 : 0);

  const trust =
    (candidate.photoVerified ? 1 : 0) + (candidate.ageVerified ? 0.5 : 0);

  const total =
    mutualFit +
    sharedGoals +
    kinks +
    limitsClash +
    distance +
    activity +
    profileQuality +
    trust;

  return {
    total: Math.round(total * 100) / 100,
    mutualFit,
    sharedGoals,
    kinks,
    limitsClash,
    distance,
    activity,
    profileQuality,
    trust,
    hardClashes,
  };
}
