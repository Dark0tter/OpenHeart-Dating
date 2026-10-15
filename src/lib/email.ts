import { appUrl } from "@/lib/request";

type Email = {
  to: string;
  subject: string;
  /** Plain paragraphs; each becomes a <p> in the HTML version. */
  paragraphs: string[];
  action?: { label: string; url: string };
};

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderEmail(email: Email) {
  const text = [
    ...email.paragraphs,
    ...(email.action ? [`${email.action.label}: ${email.action.url}`] : []),
    "",
    `Kindred Kinks · ${appUrl()}`,
    "You're getting this because of your Kindred Kinks account. Notification emails can be turned off in Settings.",
  ].join("\n\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f8f0ef;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#24142a">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-size:22px;color:#4a2257;margin:0 0 24px">Kindred Kinks</p>
${email.paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;margin:0 0 16px">${escapeHtml(p)}</p>`).join("\n")}
${
  email.action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(email.action.url)}" style="background:#4a2257;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-size:15px">${escapeHtml(email.action.label)}</a></p>
<p style="font-size:12px;color:#6b7280;word-break:break-all">If the button doesn't work, copy this link: ${escapeHtml(email.action.url)}</p>`
    : ""
}
<p style="font-size:12px;color:#6b7280;margin-top:32px">You're getting this because of your Kindred Kinks account. Notification emails can be turned off in Settings.</p>
</div></body></html>`;

  return { text, html };
}

/**
 * Sends through Resend's HTTP API when RESEND_API_KEY and EMAIL_FROM are set.
 * Without them (local development), the email is printed to the server log so
 * links can still be followed.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  const { text, html } = renderEmail(email);

  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.warn(`[email] not configured; dropped "${email.subject}"`);
      return false;
    }
    console.info(
      `\n[email] To: ${email.to}\nSubject: ${email.subject}\n\n${text}\n`,
    );
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      console.error(`[email] send failed: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] send failed", e);
    return false;
  }
}
