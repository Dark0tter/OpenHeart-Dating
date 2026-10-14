"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Request = {
  id: string;
  body: string;
  createdAt: string;
  from?: { id: string; displayName: string };
  to?: { id: string; displayName: string };
};

type Conversation = {
  id: string;
  lastMessage: { body: string | null } | null;
  otherUser: { id: string; displayName: string; age: number };
};

export default function MessagesPage() {
  const router = useRouter();
  const [incoming, setIncoming] = useState<Request[]>([]);
  const [outgoing, setOutgoing] = useState<Request[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  async function load() {
    const [reqRes, matchRes] = await Promise.all([
      fetch("/api/message-requests"),
      fetch("/api/matches"),
    ]);
    if (reqRes.ok) {
      const d = await reqRes.json();
      setIncoming(d.incoming);
      setOutgoing(d.outgoing);
    }
    if (matchRes.ok) {
      const d = await matchRes.json();
      setConversations(d.matches);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function respond(id: string, action: "accept" | "deny") {
    const res = await fetch(`/api/message-requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (res.ok && data.matchId) {
      router.push(`/messages/${data.matchId}`);
      return;
    }
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Messages
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Private chats open when someone accepts your request or you match.
        Messaging is never paywalled.
      </p>

      {incoming.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-sage">
            Requests for you
          </h2>
          <ul className="mt-3 space-y-3">
            {incoming.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-forest/10 bg-cream/70 p-4"
              >
                <p className="font-medium text-forest">{r.from?.displayName}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">
                  {r.body}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => respond(r.id, "accept")}
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => respond(r.id, "deny")}
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-sage">
          Conversations
        </h2>
        <ul className="mt-3 divide-y divide-forest/10">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                className="flex items-center justify-between py-4 hover:bg-mist/40"
              >
                <div>
                  <p className="font-medium text-ink">
                    {c.otherUser.displayName}, {c.otherUser.age}
                  </p>
                  <p className="line-clamp-1 text-sm text-ink/55">
                    {c.lastMessage?.body ?? "Say hello"}
                  </p>
                </div>
                <span className="text-sm text-coral">Open</span>
              </Link>
            </li>
          ))}
        </ul>
        {conversations.length === 0 && (
          <p className="mt-3 text-sm text-ink/55">
            No private chats yet. Meet people in{" "}
            <Link href="/rooms" className="underline">
              rooms
            </Link>
            .
          </p>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-sage">
            Waiting for a reply
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-ink/70">
            {outgoing.map((r) => (
              <li key={r.id}>{r.to?.displayName}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
