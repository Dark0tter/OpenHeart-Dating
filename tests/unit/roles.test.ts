import { describe, expect, it } from "vitest";
import { isAdmin, isStaff, outranks, roleRank } from "@/lib/roles";

describe("staff ranks", () => {
  it("orders member < moderator < admin < owner", () => {
    expect(roleRank("MEMBER")).toBeLessThan(roleRank("MODERATOR"));
    expect(roleRank("MODERATOR")).toBeLessThan(roleRank("ADMIN"));
    expect(roleRank("ADMIN")).toBeLessThan(roleRank("OWNER"));
    expect(roleRank(null)).toBe(roleRank("MEMBER"));
  });

  it("treats the owner as staff and admin", () => {
    expect(isStaff("OWNER")).toBe(true);
    expect(isAdmin("OWNER")).toBe(true);
    expect(isAdmin("MODERATOR")).toBe(false);
    expect(isStaff("MEMBER")).toBe(false);
  });

  it("only lets staff act on people below them", () => {
    expect(outranks("MODERATOR", "MEMBER")).toBe(true);
    expect(outranks("MODERATOR", "MODERATOR")).toBe(false);
    expect(outranks("MODERATOR", "ADMIN")).toBe(false);
    expect(outranks("ADMIN", "OWNER")).toBe(false);
    expect(outranks("OWNER", "ADMIN")).toBe(true);
  });
});
