import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apnsJwt, apnsPayload, fcmMessage } from "@/lib/native-push";
import { safeInternalPath } from "@/lib/native-app";

describe("Apple push token", () => {
  it("is a valid ES256 JWT for the team and key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-256",
    });
    const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const jwt = apnsJwt(
      "KEY123",
      "TEAM456",
      pem.replace(/\n/g, "\\n"),
      1_700_000_000,
    );
    const [h, c, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({
      alg: "ES256",
      kid: "KEY123",
    });
    expect(JSON.parse(Buffer.from(c, "base64url").toString())).toEqual({
      iss: "TEAM456",
      iat: 1_700_000_000,
    });
    expect(
      verify(
        "sha256",
        Buffer.from(`${h}.${c}`),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(s, "base64url"),
      ),
    ).toBe(true);
  });
});

describe("push payloads", () => {
  it("carry only the discreet title, body and in-app link", () => {
    expect(apnsPayload({ title: "New match", link: "/messages/m1" })).toEqual({
      aps: { alert: { title: "New match" }, sound: "default" },
      url: "/messages/m1",
    });
    expect(
      fcmMessage("tok", { title: "New message", body: "Open to read" }),
    ).toEqual({
      message: {
        token: "tok",
        notification: { title: "New message", body: "Open to read" },
        data: { url: "/" },
        android: { priority: "HIGH", ttl: "3600s" },
      },
    });
  });
});

describe("tapped notification links", () => {
  it("only opens pages inside the site", () => {
    expect(safeInternalPath("/messages/abc")).toBe("/messages/abc");
    expect(safeInternalPath("//evil.example")).toBeNull();
    expect(safeInternalPath("https://evil.example")).toBeNull();
    expect(safeInternalPath(42)).toBeNull();
  });
});
