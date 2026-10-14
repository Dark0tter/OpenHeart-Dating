import { describe, expect, it } from "vitest";
import { ContentTier } from "@prisma/client";
import { findSolicitation } from "@/lib/moderation/solicitation";
import { scamSignals } from "@/lib/moderation/scam";
import { maskExplicit, textFilterFor } from "@/lib/moderation/app-text";

const labels = (text: string) =>
  findSolicitation({ bio: text }).map((m) => m.category);

describe("solicitation filter", () => {
  it.each([
    ["my amazon.com/hz/wishlist/ls/ABC123", "wishlist"],
    ["c a s h a p p me", "payment"],
    ["tips: $rubyrose", "payment"],
    ["venmo @someone", "payment"],
    ["paypal dot me/me", "payment"],
    ["ko-fi.com/me", "tip_jar"],
    ["subscribe to my OF", "paid_content"],
    ["0nly fans? no — onlyfans.com/me", "paid_content"],
    ["spoil me", "money_request"],
    ["looking for a pay pig", "findom"],
    ["f1nd0m", "findom"],
  ])("blocks %j", (text, category) => {
    expect(labels(text)).toContain(category);
  });

  it.each([
    "I love hiking and cooking for friends",
    "Paying it forward: I volunteer on weekends",
    "Dom looking for a sub, safe sane and consensual",
    "My cat is called Venus",
    "Gift of the gab, ask me anything",
    "Costs $50 to get in to the munch? No — it's free",
  ])("allows %j", (text) => {
    expect(findSolicitation({ bio: text })).toEqual([]);
  });

  it("reports which field matched", () => {
    const m = findSolicitation({ bio: "hi", headline: "venmo me" });
    expect(m).toHaveLength(1);
    expect(m[0].field).toBe("headline");
  });
});

describe("scam signals", () => {
  it.each([
    ["Add me on WhatsApp, I'm rarely on here", "Moving the chat off the site"],
    ["text me +1 (555) 123-4567", "Sharing a phone number"],
    [
      "I made a fortune on a crypto trading platform",
      "Crypto or investment pitch",
    ],
    ["can you get me a steam card", "Gift card request"],
    ["I'm deployed overseas right now", "Common scam story"],
    [
      "please complete this safety verification first",
      "Fake verification request",
    ],
  ])("flags %j", (text, label) => {
    expect(scamSignals(text)).toContain(label);
  });

  it.each([
    "Want to grab coffee Saturday at 10?",
    "My birthday is 12/04/1990",
    "The munch is on 2026-11-14 at 7pm",
    "",
  ])("doesn't flag %j", (text) => {
    expect(scamSignals(text)).toEqual([]);
  });

  it("handles null", () => {
    expect(scamSignals(null)).toEqual([]);
  });
});

describe("app text masking", () => {
  it("masks explicit words but keeps lookalikes", () => {
    expect(maskExplicit("so horny tonight")).toBe("so h•••• tonight");
    expect(maskExplicit("cocktail analysis with Dickens")).toBe(
      "cocktail analysis with Dickens",
    );
  });

  it("only masks when the viewer can't see adult text", () => {
    const mobile = textFilterFor([ContentTier.STANDARD]);
    const web = textFilterFor([
      ContentTier.STANDARD,
      ContentTier.ADULT_TEXT,
      ContentTier.WEB_ONLY,
    ]);
    expect(mobile("nudes")).toBe("n••••");
    expect(web("nudes")).toBe("nudes");
  });
});
