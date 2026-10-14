/**
 * Kink interest levels and limits. `NO` is stored for backwards compatibility
 * and shown everywhere as "Soft limit": not for me, or only with a lot of
 * trust and negotiation. `HARD_LIMIT` is never, not negotiable.
 */
export type KinkLevel =
  "FAVORITE" | "INTERESTED" | "CURIOUS" | "NO" | "HARD_LIMIT";

export const LEVEL_LABEL: Record<KinkLevel, string> = {
  FAVORITE: "Favorite",
  INTERESTED: "Interested",
  CURIOUS: "Curious",
  NO: "Soft limit",
  HARD_LIMIT: "Hard limit",
};

export const POSITIVE_LEVELS: KinkLevel[] = [
  "FAVORITE",
  "INTERESTED",
  "CURIOUS",
];
export const LIMIT_LEVELS: KinkLevel[] = ["NO", "HARD_LIMIT"];

export const isPositive = (l: KinkLevel) => POSITIVE_LEVELS.includes(l);
export const isLimit = (l: KinkLevel) => LIMIT_LEVELS.includes(l);

/** How much an interest-versus-limit clash lowers a match score. */
const CLASH_PENALTY: Record<
  "NO" | "HARD_LIMIT",
  Partial<Record<KinkLevel, number>>
> = {
  HARD_LIMIT: { FAVORITE: 3, INTERESTED: 2, CURIOUS: 1 },
  NO: { FAVORITE: 1.5, INTERESTED: 1, CURIOUS: 0.5 },
};

export function clashPenalty(a: KinkLevel, b: KinkLevel): number {
  if (isLimit(a) && isPositive(b))
    return CLASH_PENALTY[a as "NO" | "HARD_LIMIT"][b] ?? 0;
  if (isLimit(b) && isPositive(a))
    return CLASH_PENALTY[b as "NO" | "HARD_LIMIT"][a] ?? 0;
  return 0;
}

type Entry = { kinkId: string; level: KinkLevel; name?: string };

export type Clash = {
  kink: string;
  /** "theirs": something you're into is their limit. "yours": the other way round. */
  whose: "theirs" | "yours";
  limit: "hard" | "soft";
  interest: KinkLevel;
};

/**
 * Where one person's interests meet the other's limits. Hard limits first,
 * then by how strongly the interest is held.
 */
export function findClashes(mine: Entry[], theirs: Entry[]): Clash[] {
  const theirMap = new Map(theirs.map((t) => [t.kinkId, t]));
  const out: Clash[] = [];
  for (const m of mine) {
    const t = theirMap.get(m.kinkId);
    if (!t) continue;
    const kink = t.name ?? m.name ?? m.kinkId;
    if (isPositive(m.level) && isLimit(t.level)) {
      out.push({
        kink,
        whose: "theirs",
        limit: t.level === "HARD_LIMIT" ? "hard" : "soft",
        interest: m.level,
      });
    } else if (isLimit(m.level) && isPositive(t.level)) {
      out.push({
        kink,
        whose: "yours",
        limit: m.level === "HARD_LIMIT" ? "hard" : "soft",
        interest: t.level,
      });
    }
  }
  const rank = (c: Clash) =>
    (c.limit === "hard" ? 0 : 10) + POSITIVE_LEVELS.indexOf(c.interest);
  return out.sort((a, b) => rank(a) - rank(b) || a.kink.localeCompare(b.kink));
}
