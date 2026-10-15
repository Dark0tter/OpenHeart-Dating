import { describe, expect, it } from "vitest";
import { missingSettings } from "@/lib/startup-check";

describe("startup settings check", () => {
  it("names each missing required setting", () => {
    const missing = missingSettings({ DATABASE_URL: "postgres://x" });
    expect(missing.map((m) => m.split(" ")[0])).toEqual([
      "AUTH_SECRET",
      "BAN_HASH_SECRET",
      "APP_URL",
    ]);
  });

  it("accepts the alternative names and ignores blank values", () => {
    expect(
      missingSettings({
        DATABASE_URL: "postgres://x",
        NEXTAUTH_SECRET: "s",
        BAN_HASH_SECRET: "b",
        AUTH_URL: "https://kindredkinks.com",
      }),
    ).toEqual([]);
    expect(missingSettings({ DATABASE_URL: "  " })[0]).toMatch(/^DATABASE_URL/);
  });
});
