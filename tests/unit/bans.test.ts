import { describe, expect, it } from "vitest";
import { emailBanHash, identityBanHash, normalizeEmail } from "@/lib/bans";

describe("ban hashes", () => {
  it("treats common email variations as the same address", () => {
    expect(normalizeEmail(" Jo.Doe+dating@GMail.com ")).toBe("jodoe@gmail.com");
    expect(normalizeEmail("jo+x@example.org")).toBe("jo@example.org");
    expect(emailBanHash("J.o@gmail.com")).toBe(
      emailBanHash("jo@googlemail.com"),
    );
    expect(emailBanHash("jo@example.org")).not.toBe(
      emailBanHash("jo@example.com"),
    );
  });

  it("matches identities regardless of case and accents", () => {
    const a = identityBanHash("José", "O'Neil", "1990-02-03");
    expect(a).toBe(identityBanHash("jose", "ONEIL", "1990-02-03T00:00:00Z"));
    expect(a).not.toBe(identityBanHash("jose", "oneil", "1990-02-04"));
  });

  it("needs a full name and birthdate", () => {
    expect(identityBanHash("Jo", null, "1990-01-01")).toBeNull();
    expect(identityBanHash("Jo", "Doe", "unknown")).toBeNull();
  });
});
