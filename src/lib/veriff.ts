import { createHmac, timingSafeEqual } from "crypto";
import type { ProviderDecision } from "@/lib/verification-decision";
import { decisionFromBirthdate } from "@/lib/verification-decision";

const SESSION_ID = /^[A-Za-z0-9-]+$/;

function veriffApi() {
  return process.env.VERIFF_BASE_URL || "https://stationapi.veriff.com/v1";
}

export function veriffConfigured(): boolean {
  return Boolean(
    process.env.VERIFF_API_KEY && process.env.VERIFF_SHARED_SECRET,
  );
}

function sign(payload: string): string {
  return createHmac("sha256", process.env.VERIFF_SHARED_SECRET ?? "")
    .update(payload, "utf8")
    .digest("hex");
}

/** Starts a hosted Veriff check; the member is sent to `url`. */
export async function createVeriffSession(
  opts: { reference: string; callback: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ sessionId: string; url: string }> {
  const res = await fetchImpl(`${veriffApi()}/sessions`, {
    method: "POST",
    headers: {
      "X-AUTH-CLIENT": process.env.VERIFF_API_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      verification: { callback: opts.callback, vendorData: opts.reference },
    }),
  });
  if (!res.ok) throw new Error(`Veriff session failed: ${res.status}`);
  const data = (await res.json()) as {
    verification?: { id?: string; url?: string };
  };
  if (!data.verification?.id || !data.verification.url) {
    throw new Error("Veriff session response was missing id or url");
  }
  return { sessionId: data.verification.id, url: data.verification.url };
}

/**
 * Asks Veriff to delete a finished session and its data (gone from the API
 * at once, erased within 12 hours). Veriff must switch this endpoint on for
 * the account, and it is rate limited, so failures are retried by the jobs.
 */
export async function deleteVeriffSession(
  sessionId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const key = process.env.VERIFF_API_KEY;
  if (!key || !process.env.VERIFF_SHARED_SECRET) return false;
  if (!SESSION_ID.test(sessionId)) return false;
  try {
    const res = await fetchImpl(`${veriffApi()}/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        "X-AUTH-CLIENT": key,
        "X-HMAC-SIGNATURE": sign(sessionId),
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.error(`Veriff deletion failed for ${sessionId}: ${res.status}`);
    }
    return res.ok;
  } catch (err) {
    console.error(`Veriff deletion failed for ${sessionId}`, err);
    return false;
  }
}

/** Veriff signs the raw webhook body with the shared secret (X-HMAC-SIGNATURE). */
export function veriffSignatureValid(
  header: string | null,
  rawBody: string,
  secret: string,
): boolean {
  if (!header || !/^[0-9a-f]+$/i.test(header)) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest();
  const got = Buffer.from(header, "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

type VeriffEvent = {
  verification?: {
    id?: string;
    status?: string;
    vendorData?: string | null;
    person?: {
      firstName?: string | null;
      lastName?: string | null;
      dateOfBirth?: string | null;
    } | null;
  };
};

/** Turns a Veriff decision webhook into our decision; null means "not final yet". */
export function veriffDecision(event: VeriffEvent): ProviderDecision | null {
  const v = event.verification;
  const reference = v?.vendorData;
  const sessionId = v?.id;
  if (!v || !reference || !sessionId) return null;

  const identity = {
    first: v.person?.firstName ?? null,
    last: v.person?.lastName ?? null,
    birthdate: v.person?.dateOfBirth ?? null,
  };

  switch (v.status) {
    case "approved":
      return {
        reference,
        sessionId,
        identity,
        ...decisionFromBirthdate(identity.birthdate, null),
      };
    case "declined":
      return { reference, sessionId, identity, outcome: "REJECTED" };
    case "expired":
    case "abandoned":
      return { reference, sessionId, identity, outcome: "NOT_VERIFIED" };
    default:
      return null;
  }
}
