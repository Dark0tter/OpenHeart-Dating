import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDiditSession,
  deleteDiditSession,
  diditDecision,
  diditSignatureValid,
} from "@/lib/didit";
import {
  createVeriffSession,
  deleteVeriffSession,
  veriffDecision,
  veriffSignatureValid,
} from "@/lib/veriff";
import { personaDecision } from "@/lib/persona";
import { activeProvider, deleteProviderData } from "@/lib/verification";

type Call = { url: string; init: RequestInit };

function mockFetch(status: number, body: unknown = {}) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : JSON.stringify(body), {
      status,
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const hmacHex = (secret: string, data: string) =>
  createHmac("sha256", secret).update(data, "utf8").digest("hex");

const header = (init: RequestInit, name: string) =>
  new Headers(init.headers).get(name);

beforeEach(() => {
  vi.stubEnv("DIDIT_API_KEY", "didit-key");
  vi.stubEnv("DIDIT_WORKFLOW_ID", "wf-123");
  vi.stubEnv("DIDIT_WEBHOOK_SECRET", "didit-secret");
  vi.stubEnv("VERIFF_API_KEY", "veriff-key");
  vi.stubEnv("VERIFF_SHARED_SECRET", "veriff-secret");
  vi.stubEnv("VERIFF_BASE_URL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Didit", () => {
  it("starts a hosted session tied to our reference", async () => {
    const { impl, calls } = mockFetch(201, {
      session_id: "4c5c7f3a-1f82-4f3b-8d8e-1a8d2d2f9b7a",
      url: "https://verify.didit.me/session/abc",
    });
    const s = await createDiditSession(
      { reference: "didit_ref_1", callback: "https://site/cb" },
      impl,
    );
    expect(s).toEqual({
      sessionId: "4c5c7f3a-1f82-4f3b-8d8e-1a8d2d2f9b7a",
      url: "https://verify.didit.me/session/abc",
    });
    expect(calls[0].url).toBe("https://verification.didit.me/v3/session/");
    expect(calls[0].init.method).toBe("POST");
    expect(header(calls[0].init, "x-api-key")).toBe("didit-key");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      workflow_id: "wf-123",
      vendor_data: "didit_ref_1",
      callback: "https://site/cb",
    });
  });

  it("throws when Didit refuses to start a session", async () => {
    const { impl } = mockFetch(403, { detail: "no" });
    await expect(
      createDiditSession({ reference: "r", callback: "c" }, impl),
    ).rejects.toThrow("403");
  });

  it("deletes the session and all its data after the check", async () => {
    const { impl, calls } = mockFetch(204);
    expect(await deleteDiditSession("sess-1", impl)).toBe(true);
    expect(calls[0].url).toBe(
      "https://verification.didit.me/v3/session/sess-1/delete/",
    );
    expect(calls[0].init.method).toBe("DELETE");
    expect(header(calls[0].init, "x-api-key")).toBe("didit-key");
  });

  it("treats an already-deleted session as deleted, and errors as not", async () => {
    expect(await deleteDiditSession("s", mockFetch(404).impl)).toBe(true);
    expect(await deleteDiditSession("s", mockFetch(500).impl)).toBe(false);
  });

  it("won't call Didit without a key or with a malformed id", async () => {
    const { impl, calls } = mockFetch(204);
    expect(await deleteDiditSession("../x", impl)).toBe(false);
    vi.stubEnv("DIDIT_API_KEY", "");
    expect(await deleteDiditSession("s", impl)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  describe("webhook signature", () => {
    const now = 1_800_000_000_000;
    const ts = String(now / 1000);
    const raw = '{"status":"Approved","session_id":"s","name":"Zoë"}';
    const canonical = '{"name":"Zoë","session_id":"s","status":"Approved"}';

    it("accepts X-Signature-V2 over the sorted JSON", () => {
      const v2 = hmacHex("didit-secret", canonical);
      expect(
        diditSignatureValid(
          { signatureV2: v2, signature: null, timestamp: ts },
          raw,
          "didit-secret",
          now,
        ),
      ).toBe(true);
    });

    it("accepts X-Signature over the raw body", () => {
      const sig = hmacHex("didit-secret", raw);
      expect(
        diditSignatureValid(
          { signatureV2: null, signature: sig, timestamp: ts },
          raw,
          "didit-secret",
          now,
        ),
      ).toBe(true);
    });

    it("rejects a wrong secret, a stale timestamp, or no timestamp", () => {
      const v2 = hmacHex("didit-secret", canonical);
      const bad = hmacHex("other", canonical);
      const check = (sig: string, t: string | null, at = now) =>
        diditSignatureValid(
          { signatureV2: sig, signature: null, timestamp: t },
          raw,
          "didit-secret",
          at,
        );
      expect(check(bad, ts)).toBe(false);
      expect(check(v2, ts, now + 6 * 60 * 1000)).toBe(false);
      expect(check(v2, null)).toBe(false);
    });
  });

  describe("decision", () => {
    const event = (status: string, dob: string | null = "1990-05-01") => ({
      webhook_type: "status.updated",
      session_id: "sess-1",
      status,
      vendor_data: "didit_ref_1",
      decision: {
        id_verifications: [
          { date_of_birth: dob, first_name: "Ana", last_name: "Lee" },
        ],
      },
    });

    it("approves adults and keeps the name and birthdate for the ban check", () => {
      expect(diditDecision(event("Approved"))).toEqual({
        reference: "didit_ref_1",
        sessionId: "sess-1",
        outcome: "VERIFIED_ADULT",
        underage: false,
        identity: { first: "Ana", last: "Lee", birthdate: "1990-05-01" },
      });
    });

    it("rejects an approved ID that shows the person is under 18", () => {
      const young = new Date();
      young.setUTCFullYear(young.getUTCFullYear() - 17);
      const d = diditDecision(
        event("Approved", young.toISOString().slice(0, 10)),
      );
      expect(d?.outcome).toBe("REJECTED");
      expect(d?.underage).toBe(true);
    });

    it("maps declined and abandoned, and waits on anything else", () => {
      expect(diditDecision(event("Declined"))?.outcome).toBe("REJECTED");
      expect(diditDecision(event("Abandoned"))?.outcome).toBe("NOT_VERIFIED");
      expect(diditDecision(event("Kyc Expired"))?.outcome).toBe("NOT_VERIFIED");
      expect(diditDecision(event("In Review"))).toBeNull();
      expect(
        diditDecision({ ...event("Approved"), webhook_type: "data.updated" }),
      ).toBeNull();
    });
  });
});

describe("Veriff", () => {
  it("starts a hosted session tied to our reference", async () => {
    const { impl, calls } = mockFetch(201, {
      status: "success",
      verification: { id: "v-1", url: "https://alchemy.veriff.com/v/abc" },
    });
    const s = await createVeriffSession(
      { reference: "veriff_ref_1", callback: "https://site/cb" },
      impl,
    );
    expect(s).toEqual({
      sessionId: "v-1",
      url: "https://alchemy.veriff.com/v/abc",
    });
    expect(calls[0].url).toBe("https://stationapi.veriff.com/v1/sessions");
    expect(header(calls[0].init, "x-auth-client")).toBe("veriff-key");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      verification: { callback: "https://site/cb", vendorData: "veriff_ref_1" },
    });
  });

  it("deletes a finished session, signing the id with the shared secret", async () => {
    const { impl, calls } = mockFetch(200, { status: "success" });
    expect(await deleteVeriffSession("v-1", impl)).toBe(true);
    expect(calls[0].url).toBe("https://stationapi.veriff.com/v1/sessions/v-1");
    expect(calls[0].init.method).toBe("DELETE");
    expect(header(calls[0].init, "x-auth-client")).toBe("veriff-key");
    expect(header(calls[0].init, "x-hmac-signature")).toBe(
      hmacHex("veriff-secret", "v-1"),
    );
  });

  it("reports failure when Veriff refuses (rate limit or not enabled)", async () => {
    expect(await deleteVeriffSession("v-1", mockFetch(429).impl)).toBe(false);
    expect(await deleteVeriffSession("v-1", mockFetch(400).impl)).toBe(false);
  });

  it("checks the webhook signature over the raw body", () => {
    const raw = '{"status":"success"}';
    expect(
      veriffSignatureValid(hmacHex("veriff-secret", raw), raw, "veriff-secret"),
    ).toBe(true);
    expect(
      veriffSignatureValid(hmacHex("wrong", raw), raw, "veriff-secret"),
    ).toBe(false);
    expect(veriffSignatureValid(null, raw, "veriff-secret")).toBe(false);
  });

  it("maps decisions", () => {
    const event = (status: string) => ({
      status: "success",
      verification: {
        id: "v-1",
        status,
        vendorData: "veriff_ref_1",
        person: {
          firstName: "Ana",
          lastName: "Lee",
          dateOfBirth: "1990-05-01",
        },
      },
    });
    expect(veriffDecision(event("approved"))?.outcome).toBe("VERIFIED_ADULT");
    expect(veriffDecision(event("approved"))?.identity.birthdate).toBe(
      "1990-05-01",
    );
    expect(veriffDecision(event("declined"))?.outcome).toBe("REJECTED");
    expect(veriffDecision(event("abandoned"))?.outcome).toBe("NOT_VERIFIED");
    expect(veriffDecision(event("resubmission_requested"))).toBeNull();
  });
});

describe("Persona decision", () => {
  const event = (name: string, birthdate = "1990-05-01") => ({
    data: {
      attributes: {
        name,
        payload: {
          data: {
            id: "inq_abc",
            attributes: {
              "reference-id": "persona_ref_1",
              "name-first": "Ana",
              "name-last": "Lee",
              birthdate,
            },
          },
        },
      },
    },
  });

  it("maps inquiry events and keeps the inquiry id for deletion", () => {
    const ok = personaDecision(event("inquiry.approved"));
    expect(ok?.outcome).toBe("VERIFIED_ADULT");
    expect(ok?.sessionId).toBe("inq_abc");
    expect(
      personaDecision(event("inquiry.approved", "2015-01-01"))?.underage,
    ).toBe(true);
    expect(personaDecision(event("inquiry.declined"))?.outcome).toBe(
      "REJECTED",
    );
    expect(personaDecision(event("inquiry.expired"))?.outcome).toBe(
      "NOT_VERIFIED",
    );
    expect(personaDecision(event("inquiry.started"))).toBeNull();
  });
});

describe("provider choice and deletion routing", () => {
  it("uses VERIFICATION_PROVIDER when it's set up, else the first with keys", () => {
    vi.stubEnv("VERIFICATION_PROVIDER", "veriff");
    expect(activeProvider()).toBe("veriff");
    vi.stubEnv("VERIFICATION_PROVIDER", "persona");
    expect(activeProvider()).toBe("didit");
    vi.stubEnv("DIDIT_API_KEY", "");
    vi.stubEnv("VERIFF_API_KEY", "");
    expect(activeProvider()).toBeNull();
  });

  it("sends each deletion to the provider that ran the check", async () => {
    const didit = mockFetch(204);
    await deleteProviderData("didit", "s-1", didit.impl);
    expect(didit.calls[0].url).toContain("verification.didit.me");

    const veriff = mockFetch(200);
    await deleteProviderData("veriff", "v-1", veriff.impl);
    expect(veriff.calls[0].url).toContain("stationapi.veriff.com");

    const none = mockFetch(200);
    expect(await deleteProviderData("stub", "x", none.impl)).toBe(false);
    expect(await deleteProviderData("didit", null, none.impl)).toBe(false);
    expect(none.calls).toHaveLength(0);
  });
});
