import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  hashRecoveryCode,
  hotp,
  matchTotp,
  newRecoveryCodes,
  openSecret,
  otpauthUrl,
  sealSecret,
} from "@/lib/two-step";
import { isIndexable } from "@/lib/public-pages";
import { announcementSchema } from "@/lib/announcements";
import { inquirySchema } from "@/lib/sponsor-inquiries";

const RFC_KEY = Buffer.from("12345678901234567890");
const RFC_B32 = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("authenticator codes (RFC 6238)", () => {
  it("encodes the RFC key in base32 and back", () => {
    expect(base32Encode(RFC_KEY)).toBe(RFC_B32);
    expect(base32Decode(RFC_B32).equals(RFC_KEY)).toBe(true);
    expect(
      base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq").equals(RFC_KEY),
    ).toBe(true);
  });

  it("matches the published test values", () => {
    expect(hotp(RFC_KEY, Math.floor(59 / 30), 8)).toBe("94287082");
    expect(hotp(RFC_KEY, Math.floor(1111111109 / 30), 8)).toBe("07081804");
    expect(hotp(RFC_KEY, Math.floor(1234567890 / 30), 8)).toBe("89005924");
    expect(hotp(RFC_KEY, Math.floor(1234567890 / 30))).toBe("005924");
  });

  it("allows one step of clock drift, and never the same step twice", () => {
    const now = 1_234_567_890_000;
    const step = Math.floor(now / 30_000);
    const at = (s: number) => hotp(RFC_KEY, s);
    expect(matchTotp(RFC_B32, at(step), { nowMs: now })).toBe(step);
    expect(matchTotp(RFC_B32, at(step - 1), { nowMs: now })).toBe(step - 1);
    expect(matchTotp(RFC_B32, at(step + 1), { nowMs: now })).toBe(step + 1);
    expect(matchTotp(RFC_B32, at(step - 2), { nowMs: now })).toBeNull();
    expect(
      matchTotp(RFC_B32, at(step), { nowMs: now, lastStep: step }),
    ).toBeNull();
    expect(
      matchTotp(RFC_B32, `${at(step).slice(0, 3)} ${at(step).slice(3)}`, {
        nowMs: now,
      }),
    ).toBe(step);
    expect(matchTotp(RFC_B32, "12345", { nowMs: now })).toBeNull();
  });

  it("builds a standard authenticator link", () => {
    const url = otpauthUrl(RFC_B32, "a@b.co");
    expect(url).toContain("otpauth://totp/Kindred%20Kinks%3Aa%40b.co?");
    expect(url).toContain(`secret=${RFC_B32}`);
    expect(url).toContain("issuer=Kindred%20Kinks");
  });
});

describe("stored secrets and recovery codes", () => {
  const original = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = "unit-test-secret";
  });
  afterEach(() => {
    process.env.AUTH_SECRET = original;
  });

  it("encrypts the key so the database never holds it in the clear", () => {
    const sealed = sealSecret(RFC_B32);
    expect(sealed).not.toContain(RFC_B32);
    expect(openSecret(sealed)).toBe(RFC_B32);
    const [iv, tag, data] = sealed.split(".");
    expect(
      openSecret([iv, tag, data.slice(0, -2) + "AA"].join(".")),
    ).toBeNull();
    process.env.AUTH_SECRET = "a-different-secret";
    expect(openSecret(sealed)).toBeNull();
  });

  it("makes ten different codes and matches them loosely", () => {
    const { codes, hashes } = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(hashes[0]).toBe(
      hashRecoveryCode(codes[0].toUpperCase().replace("-", " ")),
    );
    expect(hashes.join()).not.toContain(codes[0]);
  });
});

describe("search engines", () => {
  it("may index only the public pages", () => {
    expect(isIndexable("/")).toBe(true);
    expect(isIndexable("/advertise")).toBe(true);
    expect(isIndexable("/safety/")).toBe(true);
    expect(isIndexable("/members/abc")).toBe(false);
    expect(isIndexable("/safety/check-in")).toBe(false);
    expect(isIndexable("/waitlist/confirm")).toBe(false);
    expect(isIndexable("/owner")).toBe(false);
  });
});

describe("owner forms", () => {
  const base = {
    message: "Maintenance tonight at 11pm",
    linkLabel: "",
    tone: "info" as const,
    websiteOnly: false,
    endsAt: null,
  };

  it("only links announcements to this site or https pages", () => {
    for (const linkUrl of ["", "/events", "https://example.org/x"]) {
      expect(announcementSchema.safeParse({ ...base, linkUrl }).success).toBe(
        true,
      );
    }
    for (const linkUrl of [
      "//evil.example",
      "javascript:alert(1)",
      "http://plain.example",
    ]) {
      expect(announcementSchema.safeParse({ ...base, linkUrl }).success).toBe(
        false,
      );
    }
  });

  it("checks sponsor inquiry websites", () => {
    const inquiry = {
      businessName: "Rainbow Books",
      contactName: "Sam",
      email: "SAM@Example.org",
      message: "We'd like to sponsor in Austin.",
    };
    const ok = inquirySchema.parse({
      ...inquiry,
      website: "https://rainbow.example",
    });
    expect(ok.email).toBe("sam@example.org");
    expect(inquirySchema.parse({ ...inquiry, website: "" }).website).toBeNull();
    expect(
      inquirySchema.safeParse({ ...inquiry, website: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });
});
