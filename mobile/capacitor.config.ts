import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The apps load the live website. The "OpenHeartApp" user-agent token is what
 * tells the server to apply the app store content policy (general-audience
 * content and explicit text masking) — see src/lib/content-policy.ts. Don't
 * remove it.
 *
 * Set OPENHEART_URL to the production site before `npm run sync`.
 */
const siteUrl = process.env.OPENHEART_URL ?? "https://openheart.com";
const host = new URL(siteUrl).host;

const config: CapacitorConfig = {
  appId: process.env.OPENHEART_APP_ID ?? "com.openheart.app",
  appName: "OpenHeart",
  webDir: "www",
  appendUserAgent: "OpenHeartApp",
  backgroundColor: "#f8f0ef",
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
