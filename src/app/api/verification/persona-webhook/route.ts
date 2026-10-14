import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { ageFromBirthdate, applyProviderDecision } from "@/lib/verification";

export const dynamic = "force-dynamic";

const TOLERANCE_SECONDS = 5 * 60;

/**
 * Persona-Signature: "t=<unix>,v1=<hex>" — several v1 values may be present
 * (space separated) while a webhook secret is being rotated.
 */
function signatureValid(
  header: string | null,
  rawBody: string,
  secret: string,
) {
  if (!header) return false;
  const t = /(?:^|,)\s*t=(\d+)/.exec(header)?.[1];
  const sigs = [...header.matchAll(/v1=([0-9a-f]+)/g)].map((m) => m[1]);
  if (!t || sigs.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, "hex");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

type InquiryAttributes = Record<string, unknown>;

function attr(
  a: InquiryAttributes,
  kebab: string,
  camel: string,
): string | null {
  const v = a[kebab] ?? a[camel];
  return typeof v === "string" ? v : null;
}

export async function POST(req: Request) {
  const secret = process.env.PERSONA_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawBody = await req.text();
  if (!signatureValid(req.headers.get("persona-signature"), rawBody, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    data?: {
      attributes?: {
        name?: string;
        payload?: { data?: { attributes?: InquiryAttributes } };
      };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const name = event.data?.attributes?.name ?? "";
  const inquiry = event.data?.attributes?.payload?.data?.attributes ?? {};
  const reference = attr(inquiry, "reference-id", "referenceId");
  if (!reference)
    return NextResponse.json({ ok: true, ignored: "no reference" });

  let outcome: "VERIFIED_ADULT" | "NOT_VERIFIED" | "REJECTED" | null = null;
  let underage = false;
  if (name === "inquiry.approved") {
    const birthdate = attr(inquiry, "birthdate", "birthdate");
    const age = birthdate ? ageFromBirthdate(birthdate) : null;
    if (age !== null && age < 18) {
      outcome = "REJECTED";
      underage = true;
    } else {
      outcome = "VERIFIED_ADULT";
    }
  } else if (name === "inquiry.declined") {
    outcome = "REJECTED";
  } else if (name === "inquiry.failed" || name === "inquiry.expired") {
    outcome = "NOT_VERIFIED";
  }
  if (!outcome) return NextResponse.json({ ok: true, ignored: name });

  const result = await applyProviderDecision({
    providerReference: reference,
    outcome,
    underage,
  });
  if (!result)
    return NextResponse.json({ ok: true, ignored: "unknown reference" });

  if (!underage) {
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { id: true },
    });
    if (user) {
      await notify(user.id, {
        type: "verification",
        title:
          outcome === "VERIFIED_ADULT"
            ? "Your age is verified"
            : "We couldn't verify your age",
        body:
          outcome === "VERIFIED_ADULT"
            ? "You can now activate your profile."
            : "You can try again from your profile. Contact support if you think this is a mistake.",
        link: "/onboarding",
      });
    }
  }
  return NextResponse.json({ ok: true });
}
