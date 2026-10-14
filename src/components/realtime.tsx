"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

export type RealtimeEvent =
  | { type: "message"; matchId: string }
  | { type: "typing"; matchId: string }
  | { type: "read"; matchId: string }
  | { type: "notification" };

type Listener = (e: RealtimeEvent) => void;

const RealtimeContext = createContext<{
  live: boolean;
  listen: (fn: Listener) => () => void;
}>({ live: false, listen: () => () => {} });

/** One EventSource per tab, shared by every component that wants live updates. */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState(false);
  const listeners = useRef(new Set<Listener>());

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/events");
    es.addEventListener("ready", (e) => {
      setLive(Boolean(JSON.parse((e as MessageEvent).data).live));
    });
    es.addEventListener("update", (e) => {
      const event = JSON.parse((e as MessageEvent).data) as RealtimeEvent;
      listeners.current.forEach((fn) => fn(event));
    });
    es.onerror = () => setLive(false);
    return () => es.close();
  }, []);

  const [value] = useState(() => ({
    listen(fn: Listener) {
      listeners.current.add(fn);
      return () => {
        listeners.current.delete(fn);
      };
    },
  }));

  return (
    <RealtimeContext.Provider value={{ live, listen: value.listen }}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Calls `onEvent` for live events. When live updates aren't available, calls
 * `onPoll` every `pollMs` instead so the page still refreshes.
 */
export function useRealtime(
  onEvent: Listener,
  opts?: { onPoll?: () => void; pollMs?: number },
) {
  const { live, listen } = useContext(RealtimeContext);
  const eventRef = useRef(onEvent);
  const pollRef = useRef(opts?.onPoll);
  useEffect(() => {
    eventRef.current = onEvent;
    pollRef.current = opts?.onPoll;
  });

  useEffect(() => listen((e) => eventRef.current(e)), [listen]);

  const pollMs = opts?.pollMs ?? 5000;
  useEffect(() => {
    if (live || !pollRef.current) return;
    const t = setInterval(() => pollRef.current?.(), pollMs);
    return () => clearInterval(t);
  }, [live, pollMs]);

  return live;
}
