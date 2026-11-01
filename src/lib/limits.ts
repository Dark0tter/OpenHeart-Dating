/**
 * Interest levels and limits. `NO` is stored for backwards compatibility and
 * shown everywhere as "Soft limit": not for me, or only with a lot of trust
 * and conversation. `HARD_LIMIT` is never, not negotiable.
 */
export type InterestLevel =
  "FAVORITE" | "INTERESTED" | "CURIOUS" | "NO" | "HARD_LIMIT";

export const LEVEL_LABEL: Record<InterestLevel, string> = {
  FAVORITE: "Favorite",
  INTERESTED: "Interested",
  CURIOUS: "Curious",
  NO: "Soft limit",
  HARD_LIMIT: "Hard limit",
};

export const POSITIVE_LEVELS: InterestLevel[] = [
  "FAVORITE",
  "INTERESTED",
  "CURIOUS",
];
export const LIMIT_LEVELS: InterestLevel[] = ["NO", "HARD_LIMIT"];

export const isPositive = (l: InterestLevel) => POSITIVE_LEVELS.includes(l);
export const isLimit = (l: InterestLevel) => LIMIT_LEVELS.includes(l);

/** How much an interest-versus-limit clash lowers a match score. */
const CLASH_PENALTY: Record<
  "NO" | "HARD_LIMIT",
  Partial<Record<InterestLevel, number>>
> = {
  HARD_LIMIT: { FAVORITE: 3, INTERESTED: 2, CURIOUS: 1 },
  NO: { FAVORITE: 1.5, INTERESTED: 1, CURIOUS: 0.5 },
};

export function clashPenalty(a: InterestLevel, b: InterestLevel): number {
  if (isLimit(a) && isPositive(b))
    return CLASH_PENALTY[a as "NO" | "HARD_LIMIT"][b] ?? 0;
  if (isLimit(b) && isPositive(a))
    return CLASH_PENALTY[b as "NO" | "HARD_LIMIT"][a] ?? 0;
  return 0;
}

type Entry = { interestId: string; level: InterestLevel; name?: string };

export type Clash = {
  name: string;
  /** "theirs": something you're into is their limit. "yours": the other way round. */
  whose: "theirs" | "yours";
  limit: "hard" | "soft";
  level: InterestLevel;
};

/**
 * Where one person's interests meet the other's limits. Hard limits first,
 * then by how strongly the interest is held.
 */
export function findClashes(mine: Entry[], theirs: Entry[]): Clash[] {
  const theirMap = new Map(theirs.map((t) => [t.interestId, t]));
  const out: Clash[] = [];
  for (const m of mine) {
    const t = theirMap.get(m.interestId);
    if (!t) continue;
    const name = t.name ?? m.name ?? m.interestId;
    if (isPositive(m.level) && isLimit(t.level)) {
      out.push({
        name,
        whose: "theirs",
        limit: t.level === "HARD_LIMIT" ? "hard" : "soft",
        level: m.level,
      });
    } else if (isLimit(m.level) && isPositive(t.level)) {
      out.push({
        name,
        whose: "yours",
        limit: m.level === "HARD_LIMIT" ? "hard" : "soft",
        level: t.level,
      });
    }
  }
  const rank = (c: Clash) =>
    (c.limit === "hard" ? 0 : 10) + POSITIVE_LEVELS.indexOf(c.level);
  return out.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}
