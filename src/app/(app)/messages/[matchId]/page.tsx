"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRealtime } from "@/components/realtime";
import { useCalls } from "@/components/call-provider";
import { Phone, Video } from "lucide-react";

type Message = {
  id: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
  safetyFlag?: string | null;
};

/** Combines two oldest-first lists; entries in `b` win (fresher read state). */
function mergeMessages(a: Message[], b: Message[]): Message[] {
  const byId = new Map(a.map((m) => [m.id, m]));
  for (const m of b) byId.set(m.id, m);
  return [...byId.values()].sort((x, y) =>
    x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0,
  );
}

const TYPING_SEND_MS = 3000;
const TYPING_SHOW_MS = 5000;

export default function ChatPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const loadedOnce = useRef(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [me, setMe] = useState<string | null>(null);
  const [other, setOther] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);
  const [body, setBody] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [theyreTyping, setTheyreTyping] = useState(false);
  const [ended, setEnded] = useState(false);
  const router = useRouter();
  const { startCall, inCall } = useCalls();
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/messages/${matchId}`);
    if (res.status === 404) setEnded(true);
    if (!res.ok) return;
    const data = await res.json();
    setMessages((prev) => mergeMessages(prev, data.messages));
    if (!loadedOnce.current) {
      loadedOnce.current = true;
      setHasMore(Boolean(data.hasMore));
    }
    setMe(data.me);
    setOther(data.other);
  }, [matchId]);

  async function loadEarlier() {
    const oldest = messages[0];
    if (!oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    const res = await fetch(
      `/api/messages/${matchId}?before=${encodeURIComponent(oldest.createdAt)}`,
    );
    setLoadingEarlier(false);
    if (!res.ok) return;
    const data = await res.json();
    setMessages((prev) => mergeMessages(data.messages, prev));
    setHasMore(Boolean(data.hasMore));
  }

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    loadedOnce.current = false;
    load();
  }, [load]);

  const newestId = messages[messages.length - 1]?.id;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [newestId, theyreTyping]);

  useRealtime(
    (e) => {
      if (!("matchId" in e) || e.matchId !== matchId) return;
      if (e.type === "typing") {
        setTheyreTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(
          () => setTheyreTyping(false),
          TYPING_SHOW_MS,
        );
      } else {
        if (e.type === "message") setTheyreTyping(false);
        load();
      }
    },
    { onPoll: load, pollMs: 4000 },
  );

  function onType(value: string) {
    setBody(value);
    const now = Date.now();
    if (value && now - lastTypingSent.current > TYPING_SEND_MS) {
      lastTypingSent.current = now;
      fetch(`/api/messages/${matchId}/typing`, { method: "POST" }).catch(
        () => {},
      );
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    const res = await fetch(`/api/messages/${matchId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    setSending(false);
    if (res.ok) {
      setBody("");
      setSendError(null);
      lastTypingSent.current = 0;
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setSendError(data.error ?? "Message could not be sent.");
    }
  }

  async function call(video: boolean) {
    if (!other) return;
    setSendError(null);
    const error = await startCall(matchId, video, other.displayName);
    if (error) setSendError(error);
  }

  async function unmatch() {
    if (
      !confirm(
        `Unmatch ${other?.displayName ?? "this person"}? The conversation disappears for both of you.`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    if (res.ok) router.push("/messages");
  }

  if (ended) {
    return (
      <div className="max-w-xl">
        <p className="text-ink/70">This conversation has ended.</p>
        <Link
          href="/messages"
          className="mt-2 inline-block text-forest underline"
        >
          Back to messages
        </Link>
      </div>
    );
  }

  const lastMine = [...messages].reverse().find((m) => m.senderId === me);

  return (
    <div className="flex h-[calc(100dvh-12rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col md:h-[70vh]">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
          {other ? (
            <Link href={`/members/${other.userId}`} className="hover:underline">
              {other.displayName}
            </Link>
          ) : (
            "Messages"
          )}
        </h1>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => call(false)}
            aria-label={`Voice call ${other?.displayName ?? ""}`.trim()}
            className="rounded-full p-2 text-forest hover:bg-mist disabled:opacity-50"
            disabled={!other || inCall}
          >
            <Phone aria-hidden className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => call(true)}
            aria-label={`Video call ${other?.displayName ?? ""}`.trim()}
            className="rounded-full p-2 text-forest hover:bg-mist disabled:opacity-50"
            disabled={!other || inCall}
          >
            <Video aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <details className="relative text-sm">
          <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-forest/80 hover:bg-mist">
            Options
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-forest/15 bg-cream p-1 shadow-sm">
            <Link
              href="/safety/check-in"
              className="block rounded px-3 py-2 hover:bg-mist"
            >
              Date check-in
            </Link>
            {other && (
              <Link
                href={`/settings?report=${other.userId}#report`}
                className="block rounded px-3 py-2 text-coral-deep hover:bg-mist"
              >
                Report
              </Link>
            )}
            <button
              type="button"
              onClick={unmatch}
              className="block w-full rounded px-3 py-2 text-left hover:bg-mist"
            >
              Unmatch
            </button>
            <Link
              href="/messages"
              className="block rounded px-3 py-2 hover:bg-mist"
            >
              All messages
            </Link>
          </div>
        </details>
      </div>
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-lg border border-forest/10 bg-cream/50 p-4"
      >
        {hasMore && (
          <div className="text-center">
            <button
              type="button"
              onClick={loadEarlier}
              disabled={loadingEarlier}
              className="text-sm text-forest underline disabled:opacity-50"
            >
              {loadingEarlier ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className="text-sm text-ink/70">
            Say hi! A question about something on their profile is a great
            start.
          </p>
        )}
        {messages.map((m) => {
          const mine = me !== null && m.senderId === me;
          return (
            <div
              key={m.id}
              className={mine ? "ml-auto max-w-[80%]" : "max-w-[80%]"}
            >
              <div
                className={`rounded-md px-3 py-2 text-sm ${
                  mine ? "bg-forest text-cream" : "bg-mist text-ink"
                }`}
              >
                {m.body}
                {m.safetyFlag && (
                  <span
                    role="note"
                    className="mt-2 block rounded bg-coral/15 px-2 py-1 text-xs text-coral-deep"
                  >
                    Be careful: this looks like a common scam ({m.safetyFlag}).
                    Never send money, gift cards or codes to someone you
                    haven&apos;t met, and keep chatting here until you trust
                    them.{" "}
                    <Link href="/safety" className="underline">
                      Safety tips
                    </Link>
                  </span>
                )}
              </div>
              {mine && m.id === lastMine?.id && m.readAt && (
                <p className="mt-0.5 text-right text-[11px] text-ink/70">
                  Seen
                </p>
              )}
            </div>
          );
        })}
        {theyreTyping && (
          <p className="text-xs italic text-ink/70">
            {other?.displayName ?? "They"} {other ? "is" : "are"} typing…
          </p>
        )}
        <div ref={bottom} />
      </div>
      {sendError && (
        <p
          role="alert"
          className="mt-3 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-deep"
        >
          {sendError}
        </p>
      )}
      <form onSubmit={send} className="mt-3 flex gap-2">
        <Input
          value={body}
          onChange={(e) => onType(e.target.value)}
          placeholder="Write a message…"
          aria-label="Message"
          maxLength={4000}
        />
        <Button type="submit" disabled={sending || !body.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
