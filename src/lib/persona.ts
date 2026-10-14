import { createHmac, timingSafeEqual } from "crypto";
import type { ProviderDecision } from "@/lib/verification-decision";
import { decisionFromBirthdate } from "@/lib/verification-decision";

const TOLERANCE_SECONDS = 5 * 60;
const PERSONA_API = "https://api.withpersona.com/api/v1";

/**
 * Permanently deletes an inquiry's ID images and personal data on Persona's
 * side once we have the decision (the privacy page promises we never keep
 * ID images). Needs PERSONA_API_KEY; returns false when it couldn't redact.
 */
export async function redactPersonaInquiry(
  inquiryId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const key = process.env.PERSONA_API_KEY;
  if (!key || !/^inq_[A-Za-z0-9]+$/.test(inquiryId)) return false;
  try {
    const res = await fetchImpl(`${PERSONA_API}/inquiries/${inquiryId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${key}`,
        "Persona-Version": "2023-01-05",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      console.error(`Persona redaction failed for ${inquiryId}: ${res.status}`);
    }
    return res.ok;
  } catch (err) {
    console.error(`Persona redaction failed for ${inquiryId}`, err);
    return false;
  }
}

type InquiryAttributes = Record<string, unknown>;

type PersonaEvent = {
  data?: {
    attributes?: {
      name?: string;
      payload?: { data?: { id?: string; attributes?: InquiryAttributes } };
    };
  };
};

function attr(a: InquiryAttributes, kebab: string, camel: string) {
  const v = a[kebab] ?? a[camel];
  return typeof v === "string" ? v : null;
}

/** Turns a Persona inquiry webhook into our decision; null means "not final yet". */
export function personaDecision(event: PersonaEvent): ProviderDecision | null {
  const name = event.data?.attributes?.name ?? "";
  const inquiry = event.data?.attributes?.payload?.data;
  const a = inquiry?.attributes ?? {};
  const reference = attr(a, "reference-id", "referenceId");
  if (!reference) return null;

  const identity = {
    first: attr(a, "name-first", "nameFirst"),
    last: attr(a, "name-last", "nameLast"),
    birthdate: attr(a, "birthdate", "birthdate"),
  };
  const base = { reference, sessionId: inquiry?.id ?? "", identity };

  if (name === "inquiry.approved") {
    return { ...base, ...decisionFromBirthdate(identity.birthdate, null) };
  }
  if (name === "inquiry.declined") return { ...base, outcome: "REJECTED" };
  if (name === "inquiry.failed" || name === "inquiry.expired") {
    return { ...base, outcome: "NOT_VERIFIED" };
  }
  return null;
}

/**
 * Persona-Signature: "t=<unix>,v1=<hex>" — several v1 values may be present
 * (space separated) while a webhook secret is being rotated.
 */
export function personaSignatureValid(
  header: string | null,
  rawBody: string,
  secret: string,
  nowMs = Date.now(),
): boolean {
  if (!header) return false;
  const t = /(?:^|,)\s*t=(\d+)/.exec(header)?.[1];
  const sigs = [...header.matchAll(/v1=([0-9a-f]+)/g)].map((m) => m[1]);
  if (!t || sigs.length === 0) return false;
  if (Math.abs(nowMs / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
