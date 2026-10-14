"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
  mediaHidden?: boolean;
  safetyFlag?: string | null;
};

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  async function load() {
    const [msgRes, profileRes] = await Promise.all([
      fetch(`/api/messages/${params.matchId}`),
      fetch("/api/profile"),
    ]);
    const msgData = await msgRes.json();
    const profileData = await profileRes.json();
    if (msgRes.ok) setMessages(msgData.messages);
    // profile endpoint doesn't return user id directly — derive from session via likes later
    // For styling "mine", fetch matches and compare isn't ideal; use a lightweight approach:
    if (profileData.profile?.userId) setMe(profileData.profile.userId);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.matchId]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const res = await fetch(`/api/messages/${params.matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok) {
      setBody("");
      setSendError(null);
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setSendError(data.error ?? "Message could not be sent.");
    }
  }

  return (
    <div className="flex h-[calc(100dvh-12rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col md:h-[70vh]">
      <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
        Messages
      </h1>
      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-lg border border-forest/10 bg-cream/50 p-4">
        {messages.map((m) => {
          const mine = me && m.senderId === me;
          return (
            <div
              key={m.id}
              className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${
                mine ? "ml-auto bg-forest text-cream" : "bg-mist text-ink"
              }`}
            >
              {m.body}
              {m.mediaHidden && (
                <span className="block text-xs italic opacity-70">
                  Media is only shown on the OpenHeart website.
                </span>
              )}
              {m.safetyFlag && (
                <span
                  role="note"
                  className="mt-2 block rounded bg-coral/15 px-2 py-1 text-xs text-coral-deep"
                >
                  Be careful: this looks like a common scam ({m.safetyFlag}).
                  Never send money, gift cards or codes to someone you
                  haven&apos;t met, and keep chatting here until you trust them.{" "}
                  <a href="/safety" className="underline">
                    Safety tips
                  </a>
                </span>
              )}
            </div>
          );
        })}
      </div>
      {sendError && (
        <p className="mt-3 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-deep">
          {sendError}
        </p>
      )}
      <form onSubmit={send} className="mt-3 flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
