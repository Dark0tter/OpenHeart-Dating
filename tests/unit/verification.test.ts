import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { personaSignatureValid } from "@/lib/persona";
import { ageFromBirthdate } from "@/lib/verification";
import { ageFromDob, isAdult } from "@/lib/utils";

describe("ageFromBirthdate", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  it("counts the birthday itself", () => {
    expect(ageFromBirthdate("2008-10-13", now)).toBe(18);
  });
  it("is still 17 the day before", () => {
    expect(ageFromBirthdate("2008-10-14", now)).toBe(17);
  });
  it("rejects garbage", () => {
    expect(ageFromBirthdate("13/10/2008", now)).toBeNull();
  });
});

describe("account age gate", () => {
  it("treats someone 18 years and a day old as an adult", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 18);
    dob.setDate(dob.getDate() - 1);
    expect(isAdult(dob)).toBe(true);
    expect(ageFromDob(dob)).toBe(18);
  });
  it("rejects someone a day short of 18", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 18);
    dob.setDate(dob.getDate() + 1);
    expect(isAdult(dob)).toBe(false);
  });
});

describe("Persona webhook signature", () => {
  const secret = "wbhsec_test";
  const body = JSON.stringify({
    data: { attributes: { name: "inquiry.approved" } },
  });
  const now = 1_800_000_000_000;
  const t = String(now / 1000);
  const sign = (s: string, ts = t) =>
    createHmac("sha256", s).update(`${ts}.${body}`).digest("hex");

  it("accepts a valid signature", () => {
    expect(
      personaSignatureValid(`t=${t},v1=${sign(secret)}`, body, secret, now),
    ).toBe(true);
  });

  it("accepts any of several signatures during secret rotation", () => {
    const header = `t=${t},v1=${sign("old")} v1=${sign(secret)}`;
    expect(personaSignatureValid(header, body, secret, now)).toBe(true);
  });

  it("rejects a wrong secret, a changed body, or a missing header", () => {
    expect(
      personaSignatureValid(`t=${t},v1=${sign("nope")}`, body, secret, now),
    ).toBe(false);
    expect(
      personaSignatureValid(
        `t=${t},v1=${sign(secret)}`,
        body + " ",
        secret,
        now,
      ),
    ).toBe(false);
    expect(personaSignatureValid(null, body, secret, now)).toBe(false);
    expect(personaSignatureValid("garbage", body, secret, now)).toBe(false);
  });

  it("rejects replays older than five minutes", () => {
    const old = String(now / 1000 - 301);
    expect(
      personaSignatureValid(
        `t=${old},v1=${sign(secret, old)}`,
        body,
        secret,
        now,
      ),
    ).toBe(false);
  });
});
