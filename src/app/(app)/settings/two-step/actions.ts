"use server";

import QRCode from "qrcode";
import { requireUser, isStaff } from "@/lib/session";
import { limitFor } from "@/lib/rate-limit";
import { sendTwoStepChangedEmail } from "@/lib/account-email";
import {
  beginTwoStep,
  confirmTwoStep,
  disableTwoStep,
  regenerateRecoveryCodes,
  verifySecondStep,
} from "@/lib/two-step";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const SLOW_DOWN = "Too many tries. Please wait 15 minutes and try again.";
const BAD_CODE = "That code didn't work. Try the newest one from your app.";

async function signedIn() {
  const user = await requireUser();
  if (!user) throw new Error("Please sign in again.");
  return user;
}

async function underLimit(userId: string) {
  return (await limitFor("twoStepPerUser", userId)).ok;
}

export async function startTwoStep(): Promise<
  Result<{ secret: string; qr: string }>
> {
  const user = await signedIn();
  if (user.totpEnabledAt) {
    return { ok: false, error: "Two-step sign-in is already on." };
  }
  const { secret, url } = await beginTwoStep(user.id, user.email);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
  return { ok: true, secret, qr };
}

export async function finishTwoStep(
  code: string,
): Promise<Result<{ codes: string[] }>> {
  const user = await signedIn();
  if (!(await underLimit(user.id))) return { ok: false, error: SLOW_DOWN };
  const codes = await confirmTwoStep(user.id, code);
  if (!codes) return { ok: false, error: BAD_CODE };
  await sendTwoStepChangedEmail(user.email, true);
  return { ok: true, codes };
}

export async function newRecoveryCodes(
  code: string,
): Promise<Result<{ codes: string[] }>> {
  const user = await signedIn();
  if (!(await underLimit(user.id))) return { ok: false, error: SLOW_DOWN };
  if (!(await verifySecondStep(user.id, code))) {
    return { ok: false, error: BAD_CODE };
  }
  return { ok: true, codes: await regenerateRecoveryCodes(user.id) };
}

export async function turnOffTwoStep(code: string): Promise<Result<object>> {
  const user = await signedIn();
  if (isStaff(user.role)) {
    return {
      ok: false,
      error: "Staff accounts must keep two-step sign-in on.",
    };
  }
  if (!(await underLimit(user.id))) return { ok: false, error: SLOW_DOWN };
  if (!(await verifySecondStep(user.id, code))) {
    return { ok: false, error: BAD_CODE };
  }
  await disableTwoStep(user.id);
  await sendTwoStepChangedEmail(user.email, false);
  return { ok: true };
}
