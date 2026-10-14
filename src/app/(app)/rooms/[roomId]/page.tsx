"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type RoomMessage = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  sender: { id: string; displayName: string };
};

type OnlineMember = { id: string; displayName: string };

const POLL_MS = 3000;
const ONLINE_POLL_MS = 20000;

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openActions, setOpenActions] = useState<string | null>(null);
  const [online, setOnline] = useState<OnlineMember[]>([]);
  const [youAreHidden, setYouAreHidden] = useState(false);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [hostIds, setHostIds] = useState<string[]>([]);
  const [youAreHost, setYouAreHost] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const lastSeen = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const poll = useCallback(async () => {
    const after = lastSeen.current;
    const res = await fetch(
      `/api/rooms/${roomId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`,
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not load this room.");
      return;
    }
    setRoomName(data.roomName);
    setRoom(data.room);
    if (!after) {
      setHostIds(data.room.hostIds);
      setHasEarlier(Boolean(data.hasMore));
    }
    setYouAreHost(data.youAreHost);
    setMutedUntil(data.mutedUntil);
    if (data.deletedIds?.length) {
      const gone = new Set<string>(data.deletedIds);
      setMessages((prev) => prev.filter((m) => !gone.has(m.id)));
    }
    if (data.messages.length > 0) {
      lastSeen.current = data.messages[data.messages.length - 1].createdAt;
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [
          ...prev,
          ...data.messages.filter((m: RoomMessage) => !seen.has(m.id)),
        ];
      });
    }
  }, [roomId]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [poll]);

  const pollOnline = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}/online`);
    if (!res.ok) return;
    const data = await res.json();
    setOnline(data.online);
    setYouAreHidden(data.youAreHidden);
  }, [roomId]);

  useEffect(() => {
    pollOnline();
    const t = setInterval(pollOnline, ONLINE_POLL_MS);
    return () => clearInterval(t);
  }, [pollOnline]);

  async function loadEarlier() {
    const oldest = messages[0];
    if (!oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    const res = await fetch(
      `/api/rooms/${roomId}/messages?before=${encodeURIComponent(oldest.createdAt)}`,
    );
    setLoadingEarlier(false);
    if (!res.ok) return;
    const data = await res.json();
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [
        ...data.messages.filter((m: RoomMessage) => !seen.has(m.id)),
        ...prev,
      ];
    });
    setHasEarlier(Boolean(data.hasMore));
  }

  const newestId = messages[messages.length - 1]?.id;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [newestId]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Message could not be sent.");
      return;
    }
    setBody("");
    setError(null);
    poll();
  }

  async function follow(userId: string, name: string) {
    const res = await fetch("/api/follows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    setNotice(
      res.ok
        ? `Following ${name}. Their posts will show in your feed.`
        : data.error,
    );
  }

  async function block(userId: string, name: string) {
    if (
      !confirm(`Block ${name}? You won't see each other anywhere on OpenHeart.`)
    ) {
      return;
    }
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.sender.id !== userId));
      setOnline((prev) => prev.filter((o) => o.id !== userId));
      setOpenActions(null);
      setNotice(`${name} is blocked.`);
    }
  }

  async function hostAction(payload: Record<string, unknown>, done: string) {
    const res = await fetch(`/api/rooms/${roomId}/host`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotice(data.error ?? "That didn't work.");
      return false;
    }
    setNotice(done);
    setOpenActions(null);
    if (payload.action === "delete_message") {
      setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
    }
    if (payload.action === "ban") {
      setMessages((prev) => prev.filter((m) => m.sender.id !== payload.userId));
      setOnline((prev) => prev.filter((o) => o.id !== payload.userId));
    }
    return true;
  }

  async function requestPrivate(userId: string, note: string) {
    const res = await fetch("/api/message-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: userId, body: note }),
    });
    const data = await res.json();
    if (!res.ok) {
      setNotice(data.error ?? "Request could not be sent.");
      return;
    }
    setOpenActions(null);
    if (data.matchId) {
      router.push(`/messages/${data.matchId}`);
      return;
    }
    setNotice("Request sent. You'll be able to chat privately if they accept.");
  }

  const onlineList = (
    <div className="mt-2">
      {youAreHidden && (
        <p className="mb-2 text-xs text-ink/70">
          You&apos;re hidden from this list.{" "}
          <Link href="/settings" className="underline">
            Change
          </Link>
        </p>
      )}
      <ul className="space-y-1">
        {online.map((o) => {
          const key = `online:${o.id}`;
          return (
            <li key={o.id}>
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-forest hover:underline"
                onClick={() => setOpenActions(openActions === key ? null : key)}
              >
                <span aria-hidden className="h-2 w-2 rounded-full bg-sage" />
                {o.displayName}
              </button>
              {openActions === key && (
                <MemberActions
                  name={o.displayName}
                  onRequest={(note) => requestPrivate(o.id, note)}
                  onFollow={() => follow(o.id, o.displayName)}
                  onBlock={() => block(o.id, o.displayName)}
                  reportHref={`/settings?report=${o.id}`}
                  host={
                    youAreHost && !hostIds.includes(o.id)
                      ? (payload, done) =>
                          hostAction({ ...payload, userId: o.id }, done)
                      : undefined
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
      {online.length === 0 && (
        <p className="text-xs text-ink/70">No one else is here right now.</p>
      )}
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-12rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col md:h-[75vh]">
      <div className="flex items-baseline justify-between">
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
          {roomName || "Room"}
        </h1>
        <Link href="/rooms" className="text-sm text-forest/80 hover:underline">
          All rooms
        </Link>
      </div>
      {notice && (
        <p
          role="status"
          className="mt-3 rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {notice}
        </p>
      )}
      {room?.pinnedNotice && (
        <p className="mt-3 rounded-md border border-sage/40 bg-sage/10 px-3 py-2 text-sm text-forest">
          <span className="font-medium">Pinned: </span>
          {room.pinnedNotice}
        </p>
      )}
      {(room?.rules || youAreHost) && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-forest">
            Room rules{youAreHost ? " & host settings" : ""}
          </summary>
          {room?.rules && (
            <p className="mt-2 whitespace-pre-wrap text-ink/75">{room.rules}</p>
          )}
          {room?.slowModeSeconds && room.slowModeSeconds > 2 ? (
            <p className="mt-1 text-xs text-ink/70">
              Slow mode: one message every {room.slowModeSeconds} seconds.
            </p>
          ) : null}
          {youAreHost && room && (
            <HostSettings
              room={room}
              onSave={(s) =>
                hostAction(
                  { action: "settings", ...s },
                  "Room settings saved.",
                ).then((ok) => {
                  if (ok) poll();
                })
              }
            />
          )}
        </details>
      )}
      {mutedUntil && (
        <p className="mt-2 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-deep">
          A host muted you here until {new Date(mutedUntil).toLocaleString()}.
        </p>
      )}

      <details className="mt-3 md:hidden">
        <summary className="cursor-pointer text-sm text-forest">
          Online now ({online.length})
        </summary>
        {onlineList}
      </details>

      <div className="mt-4 flex min-h-0 flex-1 gap-4">
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            role="log"
            aria-label="Room messages"
            className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-forest/10 bg-cream/50 p-4"
          >
            {hasEarlier && (
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
            {messages.map((m) => (
              <div key={m.id} className={m.mine ? "text-right" : ""}>
                <div className="text-xs text-ink/70">
                  {m.mine ? (
                    "You"
                  ) : (
                    <button
                      type="button"
                      className="font-medium text-forest hover:underline"
                      onClick={() =>
                        setOpenActions(openActions === m.id ? null : m.id)
                      }
                    >
                      {m.sender.displayName}
                    </button>
                  )}
                  {hostIds.includes(m.sender.id) && (
                    <span className="ml-1 rounded bg-sage/30 px-1 text-[10px] font-medium uppercase text-forest">
                      Host
                    </span>
                  )}{" "}
                  ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <p
                  className={`mt-1 inline-block max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-left text-sm ${
                    m.mine ? "bg-forest text-cream" : "bg-mist text-ink"
                  }`}
                >
                  {m.body}
                </p>
                {openActions === m.id && !m.mine && (
                  <MemberActions
                    name={m.sender.displayName}
                    onRequest={(note) => requestPrivate(m.sender.id, note)}
                    onFollow={() => follow(m.sender.id, m.sender.displayName)}
                    onBlock={() => block(m.sender.id, m.sender.displayName)}
                    reportHref={`/settings?report=${m.sender.id}`}
                    host={
                      youAreHost && !hostIds.includes(m.sender.id)
                        ? (payload, done) =>
                            hostAction(
                              { ...payload, userId: m.sender.id },
                              done,
                            )
                        : undefined
                    }
                    onDeleteMessage={
                      youAreHost
                        ? () =>
                            hostAction(
                              { action: "delete_message", messageId: m.id },
                              "Message deleted.",
                            )
                        : undefined
                    }
                  />
                )}
                {m.mine && youAreHost && (
                  <button
                    type="button"
                    className="mt-1 text-xs text-ink/70 hover:underline"
                    onClick={() =>
                      hostAction(
                        { action: "delete_message", messageId: m.id },
                        "Message deleted.",
                      )
                    }
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
            {messages.length === 0 && !error && (
              <p className="text-sm text-ink/70">
                It&apos;s quiet in here. Start the conversation.
              </p>
            )}
            <div ref={bottom} />
          </div>

          {error && <p className="mt-3 text-sm text-coral-deep">{error}</p>}
          <form onSubmit={send} className="mt-3 flex gap-2">
            <Input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              placeholder="Say something to the room…"
            />
            <Button type="submit">Send</Button>
          </form>
        </div>

        <aside className="hidden w-60 shrink-0 overflow-y-auto rounded-lg border border-forest/10 bg-cream/50 p-3 md:block">
          <h2 className="text-xs font-medium uppercase tracking-wide text-sage">
            Online now ({online.length})
          </h2>
          {onlineList}
        </aside>
      </div>
    </div>
  );
}

type RoomInfo = {
  rules: string | null;
  pinnedNotice: string | null;
  slowModeSeconds: number;
  hostIds: string[];
};

function HostSettings({
  room,
  onSave,
}: {
  room: RoomInfo;
  onSave: (s: {
    rules: string | null;
    pinnedNotice: string | null;
    slowModeSeconds: number;
  }) => void;
}) {
  const [rules, setRules] = useState(room.rules ?? "");
  const [pinned, setPinned] = useState(room.pinnedNotice ?? "");
  const [slow, setSlow] = useState(room.slowModeSeconds);

  return (
    <form
      className="mt-3 space-y-2 rounded-md border border-forest/15 bg-cream p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          rules: rules.trim() || null,
          pinnedNotice: pinned.trim() || null,
          slowModeSeconds: slow,
        });
      }}
    >
      <label className="block text-xs font-medium text-forest">
        Pinned notice
        <Input
          value={pinned}
          onChange={(e) => setPinned(e.target.value)}
          maxLength={300}
          className="mt-1"
        />
      </label>
      <label className="block text-xs font-medium text-forest">
        Rules
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          maxLength={3000}
          rows={4}
          className="mt-1 w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm font-normal"
        />
      </label>
      <label className="block text-xs font-medium text-forest">
        Slow mode
        <select
          value={slow}
          onChange={(e) => setSlow(Number(e.target.value))}
          className="mt-1 block h-9 rounded-md border border-forest/15 bg-cream/80 px-2 text-sm font-normal"
        >
          <option value={2}>Off</option>
          <option value={10}>10 seconds</option>
          <option value={30}>30 seconds</option>
          <option value={60}>1 minute</option>
          <option value={300}>5 minutes</option>
        </select>
      </label>
      <Button type="submit" size="sm">
        Save
      </Button>
    </form>
  );
}

function MemberActions({
  name,
  onRequest,
  onFollow,
  onBlock,
  reportHref,
  host,
  onDeleteMessage,
}: {
  name: string;
  onRequest: (note: string) => void;
  onFollow: () => void;
  onBlock: () => void;
  reportHref: string;
  host?: (payload: Record<string, unknown>, done: string) => void;
  onDeleteMessage?: () => void;
}) {
  const [note, setNote] = useState("");

  return (
    <div className="mt-2 max-w-md rounded-md border border-forest/15 bg-cream p-3 text-left">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (note.trim()) onRequest(note);
        }}
        className="space-y-2"
      >
        <label className="block text-xs font-medium text-forest">
          Ask {name} to chat privately
        </label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="A short note so they know why…"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            Send request
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onFollow}
          >
            Follow
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onBlock}>
            Block
          </Button>
          <Link
            href={reportHref}
            className="inline-flex h-9 items-center px-3 text-sm text-coral-deep hover:underline"
          >
            Report
          </Link>
        </div>
      </form>
      {(host || onDeleteMessage) && (
        <div className="mt-3 border-t border-forest/10 pt-2">
          <p className="text-xs font-medium text-forest">Host tools</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {onDeleteMessage && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onDeleteMessage}
              >
                Delete message
              </Button>
            )}
            {host && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    host(
                      { action: "mute", minutes: 60 },
                      `${name} is muted for 1 hour.`,
                    )
                  }
                >
                  Mute 1 hour
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    host(
                      { action: "mute", minutes: 24 * 60 },
                      `${name} is muted for 24 hours.`,
                    )
                  }
                >
                  Mute 24 hours
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const reason = prompt(
                      `Remove ${name} from this room? Optional reason:`,
                    );
                    if (reason !== null) {
                      host(
                        { action: "ban", reason: reason || undefined },
                        `${name} was removed from the room.`,
                      );
                    }
                  }}
                >
                  Remove from room
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
