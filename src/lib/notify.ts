import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/realtime";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/request";
import { sendNativePush } from "@/lib/native-push";

export type NotificationType =
  | "match"
  | "message"
  | "message_request"
  | "album_request"
  | "album_granted"
  | "profile_shared"
  | "selfie_result"
  | "report_update"
  | "verification"
  | "staff_alert"
  | "event"
  | "call";

/** Away this long before a message also goes out by email. */
const AWAY_MS = 15 * 60 * 1000;
/** At most one email per conversation in this window. */
const MESSAGE_EMAIL_GAP_MS = 6 * 60 * 60 * 1000;

let vapidReady: boolean | null = null;
function pushConfigured() {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  vapidReady = Boolean(pub && priv);
  if (vapidReady) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ||
        `mailto:${process.env.SUPPORT_EMAIL || "support@example.com"}`,
      pub!,
      priv!,
    );
  }
  return vapidReady;
}

async function sendPush(
  userId: string,
  payload: { title: string; body?: string; link?: string },
) {
  if (!pushConfigured()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          // Push text is shown on lock screens, so it never includes message content.
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.link ?? "/",
          }),
          { TTL: 60 * 60 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: s.id } })
            .catch(() => {});
        }
      }
    }),
  );
}

/**
 * Creates an in-app notification, updates open tabs instantly, sends a push
 * to the member's devices, and emails when they're away and opted in.
 * Notification text must be discreet: no message contents or kink details.
 */
export async function notify(
  userId: string,
  n: {
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
    email?: boolean;
  },
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      emailVerified: true,
      notifyEmail: true,
      lastActiveAt: true,
      accountStatus: true,
    },
  });
  if (!user || user.accountStatus !== "ACTIVE") return;

  let row;
  if (n.type === "message" && n.link) {
    const existing = await prisma.notification.findFirst({
      where: { userId, type: "message", link: n.link, readAt: null },
    });
    row = existing
      ? await prisma.notification.update({
          where: { id: existing.id },
          data: { title: n.title, body: n.body, createdAt: new Date() },
        })
      : await prisma.notification.create({ data: { userId, ...pick(n) } });
  } else {
    row = await prisma.notification.create({ data: { userId, ...pick(n) } });
  }

  await publish(userId, { type: "notification" });
  await Promise.all([
    sendPush(userId, n),
    sendNativePush(userId, n).catch(() => {}),
  ]);

  if (!n.email || !user.notifyEmail || !user.emailVerified) return;
  const away = Date.now() - user.lastActiveAt.getTime() > AWAY_MS;
  if (!away) return;
  if (n.type === "message" && n.link) {
    const recent = await prisma.notification.findFirst({
      where: {
        userId,
        type: "message",
        link: n.link,
        emailedAt: { gte: new Date(Date.now() - MESSAGE_EMAIL_GAP_MS) },
      },
    });
    if (recent) return;
  }
  const sent = await sendEmail({
    to: user.email,
    subject: n.title,
    paragraphs: [
      n.body ?? "You have something new on Kindred Kinks.",
      `You can turn these emails off in Settings: ${appUrl()}/settings`,
    ],
    action: n.link
      ? { label: "Go to Kindred Kinks", url: `${appUrl()}${n.link}` }
      : undefined,
  });
  if (sent) {
    await prisma.notification.update({
      where: { id: row.id },
      data: { emailedAt: new Date() },
    });
  }
}

/** Lock-screen alert only, with no entry in the notifications list (e.g. a ringing call). */
export async function pushOnly(
  userId: string,
  n: { title: string; body?: string; link?: string },
) {
  await Promise.all([
    sendPush(userId, n),
    sendNativePush(userId, n).catch(() => {}),
  ]);
}

function pick(n: {
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  return { type: n.type, title: n.title, body: n.body, link: n.link };
}
