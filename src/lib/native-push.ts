import { createSign, sign as cryptoSign } from "node:crypto";
import http2 from "node:http2";
import { prisma } from "@/lib/prisma";

/**
 * Sends notifications to the iPhone and Android apps directly through Apple
 * (APNs) and Google (Firebase Cloud Messaging). Both are free. Each is
 * skipped until its keys are set; see .env.example.
 */

export type PushPayload = { title: string; body?: string; link?: string };

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64url");

const pem = (raw: string) => raw.replace(/\\n/g, "\n");

// ---------- Apple ----------

export function apnsConfigured() {
  return Boolean(
    process.env.APNS_KEY_ID &&
    process.env.APNS_TEAM_ID &&
    process.env.APNS_PRIVATE_KEY &&
    process.env.APNS_BUNDLE_ID,
  );
}

/** Provider token for APNs (ES256, valid up to an hour). */
export function apnsJwt(
  keyId: string,
  teamId: string,
  privateKey: string,
  nowSec: number,
): string {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: nowSec }));
  const signature = cryptoSign("sha256", Buffer.from(`${header}.${claims}`), {
    key: pem(privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${claims}.${b64url(signature)}`;
}

export function apnsPayload(p: PushPayload) {
  return {
    aps: {
      alert: { title: p.title, ...(p.body ? { body: p.body } : {}) },
      sound: "default",
    },
    url: p.link ?? "/",
  };
}

let apnsToken: { value: string; at: number } | null = null;
function currentApnsToken() {
  const now = Math.floor(Date.now() / 1000);
  if (!apnsToken || now - apnsToken.at > 50 * 60) {
    apnsToken = {
      value: apnsJwt(
        process.env.APNS_KEY_ID!,
        process.env.APNS_TEAM_ID!,
        process.env.APNS_PRIVATE_KEY!,
        now,
      ),
      at: now,
    };
  }
  return apnsToken.value;
}

/** Returns device tokens Apple says are no longer valid. */
async function sendApns(tokens: string[], p: PushPayload): Promise<string[]> {
  if (!tokens.length || !apnsConfigured()) return [];
  const host =
    process.env.APNS_PRODUCTION === "false"
      ? "https://api.sandbox.push.apple.com"
      : "https://api.push.apple.com";
  const client = http2.connect(host);
  client.on("error", () => {});
  const body = JSON.stringify(apnsPayload(p));
  const dead: string[] = [];
  try {
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ":method": "POST",
              ":path": `/3/device/${token}`,
              authorization: `bearer ${currentApnsToken()}`,
              "apns-topic": process.env.APNS_BUNDLE_ID!,
              "apns-push-type": "alert",
              "apns-priority": "10",
              "apns-expiration": String(Math.floor(Date.now() / 1000) + 3600),
              "content-type": "application/json",
            });
            let status = 0;
            let text = "";
            req.setEncoding("utf8");
            req.on("response", (h) => {
              status = Number(h[":status"]);
            });
            req.on("data", (chunk) => (text += chunk));
            req.on("end", () => {
              if (
                status === 410 ||
                (status === 400 &&
                  /BadDeviceToken|DeviceTokenNotForTopic/.test(text))
              ) {
                dead.push(token);
              }
              resolve();
            });
            req.on("error", () => resolve());
            req.setTimeout(10_000, () => {
              req.close();
              resolve();
            });
            req.end(body);
          }),
      ),
    );
  } finally {
    client.close();
  }
  return dead;
}

// ---------- Google ----------

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.project_id && sa.client_email && sa.private_key ? sa : null;
  } catch {
    return null;
  }
}

export function fcmConfigured() {
  return serviceAccount() !== null;
}

export function fcmMessage(token: string, p: PushPayload) {
  return {
    message: {
      token,
      notification: { title: p.title, ...(p.body ? { body: p.body } : {}) },
      data: { url: p.link ?? "/" },
      android: { priority: "HIGH", ttl: "3600s" },
    },
  };
}

let fcmAccess: { token: string; expiresAt: number } | null = null;
async function fcmAccessToken(sa: ServiceAccount): Promise<string | null> {
  if (fcmAccess && fcmAccess.expiresAt > Date.now() + 60_000) {
    return fcmAccess.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${b64url(signer.sign(pem(sa.private_key)))}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  fcmAccess = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return fcmAccess.token;
}

/** Returns device tokens Google says are no longer valid. */
async function sendFcm(tokens: string[], p: PushPayload): Promise<string[]> {
  const sa = serviceAccount();
  if (!tokens.length || !sa) return [];
  const access = await fcmAccessToken(sa).catch(() => null);
  if (!access) return [];
  const dead: string[] = [];
  await Promise.all(
    tokens.map(async (token) => {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${access}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fcmMessage(token, p)),
          },
        );
        if (res.status === 404) dead.push(token);
        else if (!res.ok) {
          const text = await res.text();
          if (/UNREGISTERED|registration token is not a valid/i.test(text)) {
            dead.push(token);
          }
        }
      } catch {
        // Network trouble: try again with the next notification.
      }
    }),
  );
  return dead;
}

/** Sends to every app install the member has registered. */
export async function sendNativePush(userId: string, p: PushPayload) {
  if (!apnsConfigured() && !fcmConfigured()) return;
  const devices = await prisma.deviceToken.findMany({ where: { userId } });
  if (!devices.length) return;
  const ios = devices.filter((d) => d.platform === "ios").map((d) => d.token);
  const android = devices
    .filter((d) => d.platform === "android")
    .map((d) => d.token);
  const dead = [
    ...(await sendApns(ios, p).catch(() => [])),
    ...(await sendFcm(android, p).catch(() => [])),
  ];
  if (dead.length) {
    await prisma.deviceToken.deleteMany({ where: { token: { in: dead } } });
  }
}
