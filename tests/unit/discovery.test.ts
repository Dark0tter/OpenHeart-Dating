import { describe, expect, it } from "vitest";
import { approxDistanceLabel, distanceKm, orderedPair } from "@/lib/utils";
import { coarse } from "@/lib/geocode";
import { scoreMatch, type RankProfile } from "@/lib/ranking";
import { profileCompleteness } from "@/lib/profile-completeness";
import { nearbyWhere } from "@/lib/discovery";

const base: RankProfile = {
  identityIds: ["woman"],
  seekingIdentityIds: [],
  orientationIds: [],
  seekingOrientationIds: [],
  goalIds: ["dating"],
  styleIds: [],
  kinks: [],
  latitude: 40.71,
  longitude: -74.0,
  lastActiveAt: new Date(),
  publicPhotos: 2,
  bioLength: 120,
  promptCount: 1,
  photoVerified: false,
  ageVerified: true,
};

describe("location privacy", () => {
  it("stores coordinates rounded to about a kilometre", () => {
    expect(coarse(40.712776)).toBe(40.71);
    expect(coarse(-74.005974)).toBe(-74.01);
  });

  it("never shows an exact distance", () => {
    expect(approxDistanceLabel(0.3)).toBe("Nearby");
    expect(approxDistanceLabel(1.9)).toBe("Nearby");
    expect(approxDistanceLabel(7.4)).toBe("About 7 km away");
    expect(approxDistanceLabel(23)).toBe("About 25 km away");
    expect(approxDistanceLabel(900)).toBe("Far away");
  });

  it("computes great-circle distance", () => {
    // New York to Philadelphia is roughly 130 km.
    const km = distanceKm(40.71, -74.0, 39.95, -75.17);
    expect(km).toBeGreaterThan(120);
    expect(km).toBeLessThan(140);
  });
});

describe("ranking", () => {
  it("prefers people who are looking for each other", () => {
    const viewer = { ...base, seekingIdentityIds: ["woman"] };
    const fits = scoreMatch(viewer, { ...base });
    const doesnt = scoreMatch(viewer, { ...base, identityIds: ["man"] });
    expect(fits.total).toBeGreaterThan(doesnt.total);
  });

  it("counts the orientations someone wants to meet", () => {
    const viewer = { ...base, seekingOrientationIds: ["queer"] };
    const fits = scoreMatch(viewer, { ...base, orientationIds: ["queer"] });
    const doesnt = scoreMatch(viewer, {
      ...base,
      orientationIds: ["straight"],
    });
    expect(fits.mutualFit).toBeGreaterThan(doesnt.mutualFit);
  });

  it("pushes someone's hard limits down", () => {
    const viewer = {
      ...base,
      kinks: [{ kinkId: "k1", level: "HARD_LIMIT" as const }],
    };
    const clash = scoreMatch(viewer, {
      ...base,
      kinks: [{ kinkId: "k1", level: "FAVORITE" as const }],
    });
    const neutral = scoreMatch(viewer, { ...base });
    expect(clash.total).toBeLessThan(neutral.total);
  });

  it("prefers nearer people, all else equal", () => {
    const near = scoreMatch(base, { ...base, latitude: 40.72 });
    const far = scoreMatch(base, {
      ...base,
      latitude: 42.36,
      longitude: -71.06,
    });
    expect(near.distance).toBeGreaterThan(far.distance);
  });
});

describe("profile completeness", () => {
  it("goes from 0 to 100 as steps are done", () => {
    const empty = profileCompleteness({
      publicPhotos: 0,
      bio: null,
      pronouns: null,
      identityCount: 0,
      orientationCount: 0,
      goalCount: 0,
      promptCount: 0,
      hasLocation: false,
      emailVerified: false,
      ageVerified: false,
      photoVerified: false,
    });
    const full = profileCompleteness({
      publicPhotos: 4,
      bio: "x".repeat(200),
      pronouns: "she/her",
      identityCount: 1,
      orientationCount: 1,
      goalCount: 1,
      promptCount: 3,
      hasLocation: true,
      emailVerified: true,
      ageVerified: true,
      photoVerified: true,
    });
    expect(empty.percent).toBe(0);
    expect(full.percent).toBe(100);
  });
});

describe("match pairs", () => {
  it("orders a pair the same way regardless of who acts", () => {
    expect(orderedPair("b", "a")).toEqual(orderedPair("a", "b"));
  });
});

describe("nearbyWhere", () => {
  type Box = {
    OR: [
      unknown,
      {
        latitude: { gte: number; lte: number };
        longitude?: { gte: number; lte: number };
      },
    ];
  };

  it("skips the box when there's no location or radius", () => {
    expect(nearbyWhere(null, 10, 50)).toBeNull();
    expect(nearbyWhere(40, 10, undefined)).toBeNull();
  });

  it("contains every point within the radius", () => {
    const lat = 40.7;
    const lng = -74;
    const box = (nearbyWhere(lat, lng, 50) as Box).OR[1];
    for (const [dLat, dLng] of [
      [0.44, 0],
      [-0.44, 0],
      [0, 0.58],
      [0, -0.58],
    ]) {
      const pLat = lat + dLat;
      const pLng = lng + dLng;
      expect(distanceKm(lat, lng, pLat, pLng)).toBeLessThanOrEqual(50);
      expect(pLat).toBeGreaterThanOrEqual(box.latitude.gte);
      expect(pLat).toBeLessThanOrEqual(box.latitude.lte);
      expect(pLng).toBeGreaterThanOrEqual(box.longitude!.gte);
      expect(pLng).toBeLessThanOrEqual(box.longitude!.lte);
    }
  });

  it("drops the longitude limit across the date line", () => {
    const box = (nearbyWhere(10, 179.9, 100) as Box).OR[1];
    expect(box.longitude).toBeUndefined();
  });
});
