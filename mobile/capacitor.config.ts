import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The apps load the live website. The "KindredKinksApp" user-agent token is what
 * tells the server to apply the app store content policy (no adult photos,
 * explicit text masked unless opted in on the website) — see
 * src/lib/content-policy.ts. Don't remove it.
 *
 * Set KINDREDKINKS_URL to the production site before `npm run sync`.
 */
const siteUrl = process.env.KINDREDKINKS_URL ?? "https://kindredkinks.com";
const host = new URL(siteUrl).host;

const config: CapacitorConfig = {
  appId: process.env.KINDREDKINKS_APP_ID ?? "com.kindredkinks.app",
  appName: "Kindred Kinks",
  webDir: "www",
  appendUserAgent: "KindredKinksApp",
  backgroundColor: "#f3ebe3",
  server: {
    url: siteUrl,
    allowNavigation: [host],
    cleartext: false,
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "never",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
