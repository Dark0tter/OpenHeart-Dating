"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  disableNativePush,
  enableNativePush,
  nativePushAvailable,
  nativePushState,
} from "@/lib/native-app";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type PushState = "unsupported" | "off" | "on" | "blocked" | "unconfigured";

export function NotificationSettings() {
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [push, setPush] = useState<PushState>("off");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setNotifyEmail(d.notifyEmail ?? true);
        setReadReceipts(d.readReceipts ?? true);
      });

    if (nativePushAvailable()) {
      nativePushState()
        .then(setPush)
        .catch(() => setPush("off"));
      return;
    }
    if (!VAPID_KEY) return setPush("unconfigured");
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return setPush("unsupported");
    }
    if (Notification.permission === "denied") return setPush("blocked");
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setPush(sub ? "on" : "off");
    });
  }, []);

  async function save(patch: {
    notifyEmail?: boolean;
    readReceipts?: boolean;
  }) {
    const res = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setMsg(res.ok ? "Saved." : "Couldn't save that setting.");
  }

  async function enablePush() {
    setMsg(null);
    if (nativePushAvailable()) {
      const state = await enableNativePush().catch(() => "off" as const);
      setPush(state);
      setMsg(
        state === "on"
          ? "Notifications are on for this phone."
          : state === "blocked"
            ? "Notifications are turned off for OpenHeart in your phone's Settings app."
            : "Couldn't turn on notifications. Please try again.",
      );
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPush(permission === "denied" ? "blocked" : "off");
      return;
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_KEY!),
    });
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    setPush(res.ok ? "on" : "off");
    setMsg(
      res.ok
        ? "Notifications are on for this device."
        : "Couldn't turn on notifications.",
    );
  }

  async function disablePush() {
    if (nativePushAvailable()) {
      await disableNativePush();
      setPush("off");
      setMsg("Notifications are off for this phone.");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setPush("off");
    setMsg("Notifications are off for this device.");
  }

  return (
    <section className="space-y-4 rounded-lg border border-forest/10 bg-cream/60 p-4">
      <h2 className="font-medium text-forest">Notifications</h2>
      <p className="text-sm text-ink/70">
        Notifications never include message text or anything from your profile,
        so nothing private shows on a lock screen.
      </p>

      <div className="space-y-1">
        <p className="text-sm font-medium text-forest">On this device</p>
        {push === "on" && (
          <Button type="button" variant="ghost" onClick={disablePush}>
            Turn off notifications here
          </Button>
        )}
        {push === "off" && (
          <Button type="button" variant="secondary" onClick={enablePush}>
            Turn on notifications here
          </Button>
        )}
        {push === "blocked" && (
          <p className="text-sm text-ink/70">
            {nativePushAvailable()
              ? "Notifications are turned off for OpenHeart in your phone's Settings app."
              : "Notifications are blocked in your browser settings for this site."}
          </p>
        )}
        {push === "unsupported" && (
          <p className="text-sm text-ink/70">
            This browser doesn&apos;t support notifications. On iPhone, add
            OpenHeart to your Home Screen first.
          </p>
        )}
        {push === "unconfigured" && (
          <p className="text-sm text-ink/70">
            Device notifications aren&apos;t available yet.
          </p>
        )}
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={notifyEmail}
          onChange={(e) => {
            setNotifyEmail(e.target.checked);
            save({ notifyEmail: e.target.checked });
          }}
        />
        <span>
          Email me about matches, requests and messages while I&apos;m away
          <span className="block text-ink/70">
            Account and safety emails are always sent.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={readReceipts}
          onChange={(e) => {
            setReadReceipts(e.target.checked);
            save({ readReceipts: e.target.checked });
          }}
        />
        <span>
          Read receipts
          <span className="block text-ink/70">
            When off, people won&apos;t see when you&apos;ve read their
            messages, and you won&apos;t see when they&apos;ve read yours.
          </span>
        </span>
      </label>

      {msg && (
        <p role="status" className="text-sm text-forest">
          {msg}
        </p>
      )}
    </section>
  );
}
