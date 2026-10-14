import { describe, expect, it } from "vitest";
import { ContentTier } from "@prisma/client";
import {
  capFor,
  isSafeSponsorUrl,
  parseSeen,
  serializeSeen,
  sponsorTiers,
  underCap,
} from "@/lib/sponsors";
import { sponsorAllowedOn } from "@/lib/sponsor-pages";
import { hasExplicit } from "@/lib/moderation/app-text";

const now = new Date("2026-10-14T15:00:00Z");

describe("sponsor pages", () => {
  it("shows only on a few calm pages", () => {
    for (const p of [
      "/feed",
      "/search",
      "/rooms",
      "/events",
      "/events/abc",
      "/profile",
    ]) {
      expect(sponsorAllowedOn(p)).toBe(true);
    }
  });

  it("never shows in messages, chats, signup, safety, settings or on others' profiles", () => {
    for (const p of [
      "/messages",
      "/messages/m1",
      "/rooms/r1",
      "/onboarding",
      "/safety/check-in",
      "/settings",
      "/members/u1",
      "/notifications",
      "/feedback",
    ]) {
      expect(sponsorAllowedOn(p)).toBe(false);
    }
  });
});

describe("seen-today cookie", () => {
  it("round-trips today's counts", () => {
    const raw = serializeSeen({ a: 1, "b-2": 3 }, now);
    expect(parseSeen(raw, now)).toEqual({ a: 1, "b-2": 3 });
  });

  it("forgets earlier days and ignores junk", () => {
    expect(parseSeen("2026-10-13|a:2", now)).toEqual({});
    expect(parseSeen("2026-10-14|a:x,:3,b:-1,c:2,<x>:1", now)).toEqual({
      c: 2,
    });
    expect(parseSeen(undefined, now)).toEqual({});
  });
});

describe("frequency limits", () => {
  it("caps the apps lower than the website", () => {
    expect(capFor({ dailyCap: 5 }, false)).toBe(5);
    expect(capFor({ dailyCap: 5 }, true)).toBe(2);
    expect(capFor({ dailyCap: 0 }, false)).toBe(1);
  });

  it("stops once the cap is reached", () => {
    const p = { id: "a", dailyCap: 3 };
    expect(underCap(p, { a: 2 }, false)).toBe(true);
    expect(underCap(p, { a: 3 }, false)).toBe(false);
    expect(underCap(p, { a: 2 }, true)).toBe(false);
  });
});

describe("app safety", () => {
  it("apps only get listings approved for everyone", () => {
    expect(
      sponsorTiers([ContentTier.STANDARD, ContentTier.ADULT_TEXT], true),
    ).toEqual([ContentTier.STANDARD]);
    expect(
      sponsorTiers(
        [ContentTier.STANDARD, ContentTier.ADULT_TEXT, ContentTier.WEB_ONLY],
        false,
      ),
    ).toHaveLength(3);
  });

  it("only allows https links", () => {
    expect(isSafeSponsorUrl("https://example.org/shop")).toBe(true);
    expect(isSafeSponsorUrl("http://example.org")).toBe(false);
    expect(isSafeSponsorUrl("javascript:alert(1)")).toBe(false);
  });

  it("spots explicit wording", () => {
    expect(hasExplicit("Handmade leather goods")).toBe(false);
    expect(hasExplicit("Best porn deals")).toBe(true);
  });
});
