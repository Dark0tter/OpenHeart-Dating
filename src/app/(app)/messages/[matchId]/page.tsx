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
};

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [body, setBody] = useState("");

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
      await load();
    }
  }

  return (
    <div className="flex h-[70vh] flex-col">
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
                mine
                  ? "ml-auto bg-forest text-cream"
                  : "bg-mist text-ink"
              }`}
            >
              {m.body}
            </div>
          );
        })}
      </div>
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
