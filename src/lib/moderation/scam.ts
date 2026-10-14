import { ReportPriority, ReportReason, ReportSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Romance-scam patterns. Unlike the solicitation rules these don't block the
 * message (plenty of honest people mention WhatsApp); they warn the recipient
 * and, for new accounts or early in a conversation, open a report for staff.
 */
const SIGNALS: { label: string; pattern: RegExp }[] = [
  {
    label: "Moving the chat off the site",
    pattern:
      /\b(?:whats\s*app|telegram|kik|google\s*(?:chat|hangouts?)|wickr|line\s+app|viber)\b/i,
  },
  {
    label: "Sharing a phone number",
    pattern: /(?:\+?\d[\s().-]{0,2}){10,}/,
  },
  {
    label: "Crypto or investment pitch",
    pattern:
      /\b(?:bitcoin|btc|usdt|crypto(?:currency)?|forex|binary\s+options|trading\s+(?:platform|app|account)|investment\s+(?:opportunity|platform)|guaranteed\s+(?:returns?|profit))\b/i,
  },
  {
    label: "Gift card request",
    pattern:
      /\b(?:gift\s*cards?|steam\s+cards?|itunes\s+cards?|google\s+play\s+cards?)\b/i,
  },
  {
    label: "Common scam story",
    pattern:
      /\b(?:deployed\s+overseas|on\s+an?\s+oil\s+rig|peace\s*keeping\s+mission|customs\s+(?:fee|clearance)|stuck\s+at\s+the\s+airport|inheritance|hospital\s+bills?|western\s+union|moneygram)\b/i,
  },
  {
    label: "Fake verification request",
    pattern:
      /\b(?:verify\s+(?:you(?:'re|\s+are)\s+(?:real|not\s+a\s+(?:cop|fake|bot)))|safety\s+verification|verification\s+(?:link|code|site))\b/i,
  },
];

export function scamSignals(text: string | null | undefined): string[] {
  if (!text) return [];
  return SIGNALS.filter((s) => s.pattern.test(text)).map((s) => s.label);
}

const NEW_ACCOUNT_DAYS = 7;
const EARLY_MESSAGES = 6;

/**
 * Returns the warning to attach to the message (or null). Opens at most one
 * automated FRAUD report per sender per day when the risk looks real.
 */
export async function checkForScam(opts: {
  senderId: string;
  senderCreatedAt: Date;
  matchId: string;
  text: string | null | undefined;
}): Promise<string | null> {
  const signals = scamSignals(opts.text);
  if (signals.length === 0) return null;

  const newAccount =
    Date.now() - opts.senderCreatedAt.getTime() <
    NEW_ACCOUNT_DAYS * 24 * 60 * 60 * 1000;
  const sentSoFar = await prisma.message.count({
    where: { matchId: opts.matchId, senderId: opts.senderId },
  });
  const risky = newAccount || sentSoFar < EARLY_MESSAGES || signals.length >= 2;

  if (risky) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const already = await prisma.report.count({
      where: {
        reportedUserId: opts.senderId,
        reason: ReportReason.FRAUD,
        source: ReportSource.AUTOMATED,
        createdAt: { gte: since },
      },
    });
    if (already === 0) {
      await prisma.report.create({
        data: {
          reportedUserId: opts.senderId,
          source: ReportSource.AUTOMATED,
          reason: ReportReason.FRAUD,
          priority:
            signals.length >= 2 ? ReportPriority.HIGH : ReportPriority.NORMAL,
          details: JSON.stringify({
            type: "scam_signals",
            context: `message:${opts.matchId}`,
            signals,
            newAccount,
            messagesBefore: sentSoFar,
          }),
        },
      });
    }
  }

  return signals.join(", ");
}
