/**
 * Talks to the iPhone/Android app shell (Capacitor) when the site is running
 * inside it. Capacitor injects `window.Capacitor` into pages it loads, so the
 * website needs no extra packages. Everything here is a no-op in a browser.
 */

type Listener = { remove: () => Promise<void> };

type PushPlugin = {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  addListener(
    event: "registration",
    cb: (t: { value: string }) => void,
  ): Promise<Listener>;
  addListener(
    event: "registrationError",
    cb: (e: { error: string }) => void,
  ): Promise<Listener>;
  addListener(
    event: "pushNotificationActionPerformed",
    cb: (a: { notification: { data?: Record<string, unknown> } }) => void,
  ): Promise<Listener>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { PushNotifications?: PushPlugin };
};

const TOKEN_KEY = "oh-device-token";

function capacitor(): CapacitorGlobal | null {
  if (typeof window === "undefined") return null;
  const c = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return c?.isNativePlatform?.() ? c : null;
}

export function nativePlatform(): "ios" | "android" | null {
  const p = capacitor()?.getPlatform?.();
  return p === "ios" || p === "android" ? p : null;
}

function pushPlugin(): PushPlugin | null {
  return capacitor()?.Plugins?.PushNotifications ?? null;
}

export function nativePushAvailable(): boolean {
  return nativePlatform() !== null && pushPlugin() !== null;
}

/** Only follow links inside the site. */
export function safeInternalPath(url: unknown): string | null {
  return typeof url === "string" && url.startsWith("/") && !url.startsWith("//")
    ? url
    : null;
}

/** Asks the phone for a fresh token and gives it to the server. */
async function registerDevice(plugin: PushPlugin): Promise<boolean> {
  const platform = nativePlatform();
  if (!platform) return false;
  const token = await new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), 15_000);
    const listeners: Promise<Listener>[] = [];
    const done = (value: string | null) => {
      clearTimeout(timer);
      listeners.forEach((l) => l.then((x) => x.remove()).catch(() => {}));
      resolve(value);
    };
    listeners.push(plugin.addListener("registration", (t) => done(t.value)));
    listeners.push(plugin.addListener("registrationError", () => done(null)));
    plugin.register().catch(() => done(null));
  });
  if (!token) return false;
  const res = await fetch("/api/push/device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform, token }),
  });
  if (res.ok) localStorage.setItem(TOKEN_KEY, token);
  return res.ok;
}

export type NativePushState = "on" | "off" | "blocked";

export async function nativePushState(): Promise<NativePushState> {
  const plugin = pushPlugin();
  if (!plugin) return "off";
  const { receive } = await plugin.checkPermissions();
  if (receive === "denied") return "blocked";
  return receive === "granted" && localStorage.getItem(TOKEN_KEY)
    ? "on"
    : "off";
}

export async function enableNativePush(): Promise<NativePushState> {
  const plugin = pushPlugin();
  if (!plugin) return "off";
  let { receive } = await plugin.checkPermissions();
  if (receive !== "granted") ({ receive } = await plugin.requestPermissions());
  if (receive !== "granted") return receive === "denied" ? "blocked" : "off";
  return (await registerDevice(plugin)) ? "on" : "off";
}

export async function disableNativePush(): Promise<void> {
  await forgetThisDevice();
  await pushPlugin()
    ?.unregister()
    .catch(() => {});
}

/** Stops notifications to this phone, e.g. before signing out. */
export async function forgetThisDevice(): Promise<void> {
  const token =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(TOKEN_KEY)
      : null;
  if (!token) return;
  await fetch("/api/push/device", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => {});
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * On each app start: refresh the token if notifications are on, and open the
 * right page when a notification is tapped. Returns a cleanup function.
 */
export function startNativePush(open: (path: string) => void): () => void {
  const plugin = pushPlugin();
  if (!plugin) return () => {};
  const tap = plugin.addListener("pushNotificationActionPerformed", (a) => {
    const path = safeInternalPath(a.notification.data?.url);
    if (path) open(path);
  });
  plugin
    .checkPermissions()
    .then(({ receive }) => {
      if (receive === "granted" && localStorage.getItem(TOKEN_KEY)) {
        return registerDevice(plugin);
      }
    })
    .catch(() => {});
  return () => {
    tap.then((l) => l.remove()).catch(() => {});
  };
}
