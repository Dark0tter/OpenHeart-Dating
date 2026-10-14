import { describe, expect, it } from "vitest";
import { extendedUntil } from "@/lib/supporter";

const now = new Date("2026-10-14T00:00:00Z");
const days = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

describe("supporter time", () => {
  it("starts from today when there's nothing left", () => {
    expect(days(now, extendedUntil(null, 1, now))).toBe(30);
    expect(days(now, extendedUntil(new Date("2026-01-01"), 12, now))).toBe(365);
  });

  it("adds on top of time still left", () => {
    const current = new Date("2026-11-13T00:00:00Z");
    expect(days(current, extendedUntil(current, 3, now))).toBe(91);
  });
});
