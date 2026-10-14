import { createHmac, timingSafeEqual } from "crypto";
import type { ProviderDecision } from "@/lib/verification-decision";
import { decisionFromBirthdate } from "@/lib/verification-decision";

const DIDIT_API = "https://verification.didit.me/v3";
const TOLERANCE_SECONDS = 5 * 60;
const SESSION_ID = /^[A-Za-z0-9-]+$/;

export function diditConfigured(): boolean {
  return Boolean(
    process.env.DIDIT_API_KEY &&
    process.env.DIDIT_WORKFLOW_ID &&
    process.env.DIDIT_WEBHOOK_SECRET,
  );
}

/** Starts a hosted Didit check; the member is sent to `url`. */
export async function createDiditSession(
  opts: { reference: string; callback: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ sessionId: string; url: string }> {
  const res = await fetchImpl(`${DIDIT_API}/session/`, {
    method: "POST",
    headers: {
      "x-api-key": process.env.DIDIT_API_KEY ?? "",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      workflow_id: process.env.DIDIT_WORKFLOW_ID,
      vendor_data: opts.reference,
      callback: opts.callback,
    }),
  });
  if (!res.ok) throw new Error(`Didit session failed: ${res.status}`);
  const data = (await res.json()) as { session_id?: string; url?: string };
  if (!data.session_id || !data.url) {
    throw new Error("Didit session response was missing session_id or url");
  }
  return { sessionId: data.session_id, url: data.url };
}

/**
 * Deletes the session and everything in it (ID images, selfie, extracted
 * data, face embedding) on Didit's side. Immediate and irreversible. A 404
 * means it's already gone.
 */
export async function deleteDiditSession(
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const key = process.env.DIDIT_API_KEY;
  if (!key || !SESSION_ID.test(sessionId)) return false;
  try {
    const res = await fetchImpl(`${DIDIT_API}/session/${sessionId}/delete/`, {
      method: "DELETE",
      headers: { "x-api-key": key, Accept: "application/json" },
    });
    if (!res.ok && res.status !== 404) {
      console.error(`Didit deletion failed for ${sessionId}: ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Didit deletion failed for ${sessionId}`, err);
    return false;
  }
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

function hexEqual(hex: string | null, expected: Buffer): boolean {
  if (!hex || !/^[0-9a-f]+$/i.test(hex)) return false;
  const got = Buffer.from(hex, "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/**
 * Didit signs the sorted, compact JSON body (X-Signature-V2) and the raw body
 * (X-Signature) with the webhook secret; either is accepted. Requests older
 * than five minutes are rejected as replays.
 */
export function diditSignatureValid(
  headers: {
    signatureV2: string | null;
    signature: string | null;
    timestamp: string | null;
  },
  rawBody: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  const ts = Number(headers.timestamp);
  if (!headers.timestamp || !Number.isFinite(ts)) return false;
  if (Math.abs(nowMs / 1000 - ts) > TOLERANCE_SECONDS) return false;

  if (headers.signatureV2) {
    try {
      const canonical = JSON.stringify(sortKeys(JSON.parse(rawBody)));
      const expected = createHmac("sha256", secret)
        .update(canonical, "utf8")
        .digest();
      if (hexEqual(headers.signatureV2, expected)) return true;
    } catch {
      return false;
    }
  }
  const expectedRaw = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest();
  return hexEqual(headers.signature, expectedRaw);
}

type DiditEvent = {
  webhook_type?: string;
  session_id?: string;
  status?: string;
  vendor_data?: string;
  decision?: {
    id_verifications?: {
      status?: string;
      date_of_birth?: string | null;
      age?: number | null;
      first_name?: string | null;
      last_name?: string | null;
    }[];
  };
};

/** Turns a Didit status.updated webhook into our decision; null means "not final yet". */
export function diditDecision(event: DiditEvent): ProviderDecision | null {
  if (event.webhook_type && event.webhook_type !== "status.updated") {
    return null;
  }
  const reference = event.vendor_data;
  const sessionId = event.session_id;
  if (!reference || !sessionId) return null;

  const id = event.decision?.id_verifications?.[0];
  const identity = {
    first: id?.first_name ?? null,
    last: id?.last_name ?? null,
    birthdate: id?.date_of_birth ?? null,
  };

  switch (event.status) {
    case "Approved":
      return {
        reference,
        sessionId,
        identity,
        ...decisionFromBirthdate(identity.birthdate, id?.age ?? null),
      };
    case "Declined":
      return { reference, sessionId, identity, outcome: "REJECTED" };
    case "Abandoned":
    case "Expired":
    case "Kyc Expired":
      return { reference, sessionId, identity, outcome: "NOT_VERIFIED" };
    default:
      return null;
  }
}
