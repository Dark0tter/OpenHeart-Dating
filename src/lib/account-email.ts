import { AuthTokenKind } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/request";
import { issueAuthToken } from "@/lib/tokens";

export async function sendVerificationEmail(user: {
  id: string;
  email: string;
}) {
  const token = await issueAuthToken(user.id, AuthTokenKind.EMAIL_VERIFY);
  return sendEmail({
    to: user.email,
    subject: "Confirm your email for OpenHeart",
    paragraphs: [
      "Welcome to OpenHeart. Please confirm this is your email address so you can recover your account and receive notifications.",
      "This link works for 3 days. If you didn't create an OpenHeart account, you can ignore this email.",
    ],
    action: {
      label: "Confirm my email",
      url: `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`,
    },
  });
}

export async function sendPasswordResetEmail(user: {
  id: string;
  email: string;
}) {
  const token = await issueAuthToken(user.id, AuthTokenKind.PASSWORD_RESET);
  return sendEmail({
    to: user.email,
    subject: "Reset your OpenHeart password",
    paragraphs: [
      "Someone asked to reset the password for your OpenHeart account. If that was you, use the link below. It works for 1 hour.",
      "If it wasn't you, you can ignore this email. Your password won't change.",
    ],
    action: {
      label: "Choose a new password",
      url: `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`,
    },
  });
}

export async function sendPasswordChangedEmail(email: string) {
  return sendEmail({
    to: email,
    subject: "Your OpenHeart password was changed",
    paragraphs: [
      "The password for your OpenHeart account was just changed, and every device was signed out.",
      "If you didn't do this, reset your password right away and contact support.",
    ],
    action: { label: "Reset my password", url: `${appUrl()}/forgot-password` },
  });
}

export async function sendTwoStepChangedEmail(email: string, on: boolean) {
  return sendEmail({
    to: email,
    subject: on
      ? "Two-step sign-in is on for your OpenHeart account"
      : "Two-step sign-in was turned off on your OpenHeart account",
    paragraphs: [
      on
        ? "Signing in now needs your password and a code from your authenticator app. Keep your recovery codes somewhere safe."
        : "Signing in now needs only your password. Every device was signed out.",
      "If you didn't do this, reset your password right away and contact support.",
    ],
    action: { label: "Reset my password", url: `${appUrl()}/forgot-password` },
  });
}
