import { describe, expect, it } from "vitest";
import { clashPenalty, findClashes } from "@/lib/limits";
import { scoreMatch, type RankProfile } from "@/lib/ranking";

const base: RankProfile = {
  identityIds: ["a"],
  seekingIdentityIds: [],
  goalIds: [],
  styleIds: [],
  kinks: [],
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
      { kinkId: "rope", level: "FAVORITE" as const },
      { kinkId: "pain", level: "HARD_LIMIT" as const },
      { kinkId: "roleplay", level: "CURIOUS" as const },
    ];
    const theirs = [
      { kinkId: "rope", level: "NO" as const, name: "Rope" },
      { kinkId: "pain", level: "INTERESTED" as const, name: "Pain" },
      { kinkId: "roleplay", level: "HARD_LIMIT" as const, name: "Roleplay" },
    ];
    expect(findClashes(mine, theirs)).toEqual([
      { kink: "Pain", whose: "yours", limit: "hard", interest: "INTERESTED" },
      { kink: "Roleplay", whose: "theirs", limit: "hard", interest: "CURIOUS" },
      { kink: "Rope", whose: "theirs", limit: "soft", interest: "FAVORITE" },
    ]);
  });

  it("ignores shared limits and shared interests", () => {
    expect(
      findClashes(
        [
          { kinkId: "x", level: "HARD_LIMIT" },
          { kinkId: "y", level: "FAVORITE" },
        ],
        [
          { kinkId: "x", level: "NO" },
          { kinkId: "y", level: "CURIOUS" },
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
      kinks: [{ kinkId: "k", level: "INTERESTED" as const }],
    };
    const clean = scoreMatch(viewer, {
      ...base,
      kinks: [{ kinkId: "k", level: "CURIOUS" as const }],
    });
    const soft = scoreMatch(viewer, {
      ...base,
      kinks: [{ kinkId: "k", level: "NO" as const }],
    });
    const hard = scoreMatch(viewer, {
      ...base,
      kinks: [{ kinkId: "k", level: "HARD_LIMIT" as const }],
    });
    expect(clean.total).toBeGreaterThan(soft.total);
    expect(soft.total).toBeGreaterThan(hard.total);
    expect(hard.hardClashes).toBe(1);
    expect(soft.hardClashes).toBe(0);
  });
});
