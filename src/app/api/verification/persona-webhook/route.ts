import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { personaSignatureValid, redactPersonaInquiry } from "@/lib/persona";
import { ageFromBirthdate, applyProviderDecision } from "@/lib/verification";
import { identityBanHash } from "@/lib/bans";

export const dynamic = "force-dynamic";

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
  if (
    !personaSignatureValid(
      req.headers.get("persona-signature"),
      rawBody,
      secret,
    )
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    data?: {
      attributes?: {
        name?: string;
        payload?: { data?: { id?: string; attributes?: InquiryAttributes } };
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
    identityHash:
      outcome === "VERIFIED_ADULT"
        ? identityBanHash(
            attr(inquiry, "name-first", "nameFirst"),
            attr(inquiry, "name-last", "nameLast"),
            attr(inquiry, "birthdate", "birthdate"),
          )
        : null,
  });
  if (!result)
    return NextResponse.json({ ok: true, ignored: "unknown reference" });

  const inquiryId = event.data?.attributes?.payload?.data?.id;
  if (inquiryId) await redactPersonaInquiry(inquiryId);

  if (!underage && !result.banEvasion) {
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
        link: "/onboarding?step=golive",
      });
    }
  }
  return NextResponse.json({ ok: true });
}
