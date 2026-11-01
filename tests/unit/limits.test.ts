import { describe, expect, it } from "vitest";
import { clashPenalty, findClashes } from "@/lib/limits";
import { scoreMatch, type RankProfile } from "@/lib/ranking";

const base: RankProfile = {
  identityIds: ["a"],
  seekingIdentityIds: [],
  orientationIds: [],
  seekingOrientationIds: [],
  goalIds: [],
  styleIds: [],
  interests: [],
  latitude: null,
  longitude: null,
  lastActiveAt: new Date(),
  publicPhotos: 1,
  bioLength: 100,
  promptCount: 0,
  photoVerified: false,
  ageVerified: true,
};

describe("findClashes", () => {
  it("finds both directions and puts hard limits first", () => {
    const mine = [
      { interestId: "coffee", level: "FAVORITE" as const },
      { interestId: "nightlife", level: "HARD_LIMIT" as const },
      { interestId: "travel", level: "CURIOUS" as const },
    ];
    const theirs = [
      { interestId: "coffee", level: "NO" as const, name: "Coffee Dates" },
      { interestId: "nightlife", level: "INTERESTED" as const, name: "Nightlife" },
      { interestId: "travel", level: "HARD_LIMIT" as const, name: "Travel" },
    ];
    expect(findClashes(mine, theirs)).toEqual([
      { name: "Nightlife", whose: "yours", limit: "hard", level: "INTERESTED" },
      { name: "Travel", whose: "theirs", limit: "hard", level: "CURIOUS" },
      { name: "Coffee Dates", whose: "theirs", limit: "soft", level: "FAVORITE" },
    ]);
  });

  it("ignores shared limits and shared interests", () => {
    expect(
      findClashes(
        [
          { interestId: "x", level: "HARD_LIMIT" },
          { interestId: "y", level: "FAVORITE" },
        ],
        [
          { interestId: "x", level: "NO" },
          { interestId: "y", level: "CURIOUS" },
        ],
      ),
    ).toEqual([]);
  });
});

describe("limit penalties", () => {
  it("weighs hard limits more than soft ones", () => {
    expect(clashPenalty("FAVORITE", "HARD_LIMIT")).toBeGreaterThan(
      clashPenalty("FAVORITE", "NO"),
    );
    expect(clashPenalty("HARD_LIMIT", "CURIOUS")).toBeGreaterThan(0);
    expect(clashPenalty("NO", "HARD_LIMIT")).toBe(0);
  });

  it("ranks a soft-limit clash between a clean match and a hard-limit clash", () => {
    const viewer = {
      ...base,
      interests: [{ interestId: "k", level: "INTERESTED" as const }],
    };
    const clean = scoreMatch(viewer, {
      ...base,
      interests: [{ interestId: "k", level: "CURIOUS" as const }],
    });
    const soft = scoreMatch(viewer, {
      ...base,
      interests: [{ interestId: "k", level: "NO" as const }],
    });
    const hard = scoreMatch(viewer, {
      ...base,
      interests: [{ interestId: "k", level: "HARD_LIMIT" as const }],
    });
    expect(clean.total).toBeGreaterThan(soft.total);
    expect(soft.total).toBeGreaterThan(hard.total);
    expect(hard.hardClashes).toBe(1);
    expect(soft.hardClashes).toBe(0);
  });
});
