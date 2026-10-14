import { ContentTier } from "@prisma/client";

/**
 * Explicit words masked when text is shown in the mobile apps to members who
 * haven't opted in to adult content on the website. Kept to unambiguous terms
 * so ordinary words ("cocktail", "analysis", "Dickens") are untouched.
 */
const EXPLICIT_WORDS = [
  "fuck\\w*",
  "motherfuck\\w*",
  "cocks?",
  "cunts?",
  "puss(?:y|ies)",
  "dicks?",
  "cum",
  "cums",
  "cumming",
  "cummed",
  "cumshots?",
  "jizz\\w*",
  "(?:blow|hand|rim|foot)jobs?",
  "anal",
  "porn\\w*",
  "nudes?",
  "tits",
  "titties",
  "boobs?",
  "clit\\w*",
  "dildos?",
  "buttplugs?",
  "creampie\\w*",
  "gangbang\\w*",
  "bukkake",
  "deepthroat\\w*",
  "squirt(?:ing|s)?",
  "horny",
  "slut\\w*",
  "whores?",
];

const EXPLICIT_RE = new RegExp(`\\b(?:${EXPLICIT_WORDS.join("|")})\\b`, "gi");

/** Whether text shown to this client must be masked. */
export function shouldMaskText(tiers: ContentTier[]): boolean {
  return !tiers.includes(ContentTier.ADULT_TEXT);
}

export function maskExplicit(text: string): string {
  return text.replace(EXPLICIT_RE, (w) => w[0] + "•".repeat(w.length - 1));
}

export function hasExplicit(text: string): boolean {
  return new RegExp(EXPLICIT_RE.source, "i").test(text);
}

/** Returns a masker bound to the viewer's tiers, for mapping over rows. */
export function textFilterFor(tiers: ContentTier[]): (text: string) => string {
  return shouldMaskText(tiers) ? maskExplicit : (text) => text;
}
