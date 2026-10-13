import { ReportPriority, ReportReason, ReportSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SolicitationCategory =
  | "wishlist"
  | "payment"
  | "tip_jar"
  | "paid_content"
  | "money_request";

type Rule = {
  category: SolicitationCategory;
  label: string;
  /** "raw" runs on lowercased text; "compact" on text stripped to letters/digits to catch "c a s h a p p". */
  on: "raw" | "compact";
  pattern: RegExp;
};

const RULES: Rule[] = [
  { category: "wishlist", label: "Amazon wishlist", on: "raw", pattern: /amazon\.[a-z.]+\/(?:hz\/)?(?:wishlist|registry)/ },
  { category: "wishlist", label: "Amazon short link", on: "raw", pattern: /\b(?:amzn\.(?:to|eu|asia)|a\.co)\/\S+/ },
  { category: "wishlist", label: "Amazon wishlist", on: "raw", pattern: /\bamazon\s+wish\s*list\b/ },
  { category: "wishlist", label: "Throne wishlist", on: "raw", pattern: /\bthrone\.(?:com|gifts|me)\b|\bthrone\s+wish\s*list\b/ },

  { category: "payment", label: "Cash App", on: "compact", pattern: /cashapp/ },
  { category: "payment", label: "Cash App $cashtag", on: "raw", pattern: /(?:^|\s)\$[a-z][a-z0-9_-]{2,20}\b/ },
  { category: "payment", label: "Venmo", on: "compact", pattern: /venmo/ },
  { category: "payment", label: "PayPal.me", on: "compact", pattern: /paypal(?:dot)?me/ },
  { category: "payment", label: "Zelle", on: "raw", pattern: /\bzelle\b/ },

  { category: "tip_jar", label: "Buy Me a Coffee page", on: "raw", pattern: /buymeacoffee(?:\.com)?/ },
  { category: "tip_jar", label: "Ko-fi page", on: "raw", pattern: /\bko-?fi\.com\b/ },

  { category: "paid_content", label: "OnlyFans", on: "compact", pattern: /onlyfans/ },
  { category: "paid_content", label: "Fansly", on: "compact", pattern: /fansly/ },
  { category: "paid_content", label: "Paid content site", on: "raw", pattern: /\b(?:patreon|fanvue|manyvids|loyalfans|fancentro|clips4sale)\.com\b|\bjustfor\.fans\b/ },
  { category: "paid_content", label: "OnlyFans", on: "raw", pattern: /\b(?:check(?:\s+out)?|sub(?:scribe)?(?:\s+to)?|follow)\s+my\s+of\b/ },

  { category: "money_request", label: "Request for money or gifts", on: "raw", pattern: /\bspoil\s+me\b/ },
  { category: "money_request", label: "Request for money or gifts", on: "raw", pattern: /\bsend\s+(?:me\s+)?(?:money|cash|gifts?|tributes?)\b/ },
];

function normalizeRaw(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s*[([{]?\s*\bdot\b\s*[)\]}]?\s*/g, ".");
}

function normalizeCompact(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/0/g, "o")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/3/g, "e")
    .replace(/[^a-z0-9]/g, "");
}

export type SolicitationMatch = {
  field: string;
  category: SolicitationCategory;
  label: string;
  excerpt: string;
};

export function findSolicitation(
  fields: Record<string, string | null | undefined>,
): SolicitationMatch[] {
  const matches: SolicitationMatch[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const raw = normalizeRaw(value);
    const compact = normalizeCompact(value);
    for (const rule of RULES) {
      const haystack = rule.on === "raw" ? raw : compact;
      const m = rule.pattern.exec(haystack);
      if (!m) continue;
      if (matches.some((x) => x.field === field && x.label === rule.label)) {
        continue;
      }
      matches.push({
        field,
        category: rule.category,
        label: rule.label,
        excerpt:
          rule.on === "raw"
            ? haystack.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40)
            : value.slice(0, 120),
      });
    }
  }
  return matches;
}

const REPEAT_WINDOW_DAYS = 30;
const REPEAT_THRESHOLD = 3;

/**
 * Rejects the write and files an automated report for human review.
 * Nothing here suspends or bans: escalation (warning, suspension, ban,
 * verification-based ban) is a moderator decision with an appeal path.
 */
export async function enforceSolicitationPolicy(opts: {
  userId: string;
  context: string;
  fields: Record<string, string | null | undefined>;
}): Promise<{ blocked: false } | { blocked: true; labels: string[] }> {
  const matches = findSolicitation(opts.fields);
  if (matches.length === 0) return { blocked: false };

  const since = new Date(Date.now() - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = await prisma.report.count({
    where: {
      reportedUserId: opts.userId,
      reason: ReportReason.FINANCIAL_SOLICITATION,
      source: ReportSource.AUTOMATED,
      createdAt: { gte: since },
    },
  });

  await prisma.report.create({
    data: {
      reportedUserId: opts.userId,
      source: ReportSource.AUTOMATED,
      reason: ReportReason.FINANCIAL_SOLICITATION,
      priority:
        recent + 1 >= REPEAT_THRESHOLD
          ? ReportPriority.HIGH
          : ReportPriority.NORMAL,
      details: JSON.stringify({
        context: opts.context,
        attemptsInWindow: recent + 1,
        matches,
      }),
    },
  });

  return { blocked: true, labels: [...new Set(matches.map((m) => m.label))] };
}

export function solicitationErrorBody(labels: string[]) {
  return {
    code: "FINANCIAL_SOLICITATION",
    error:
      "OpenHeart doesn't allow wishlists, payment or tip links, paid-content promotion, or requests for money or gifts. " +
      `Please remove: ${labels.join(", ")}.`,
    matched: labels,
  };
}
