import { EventEmitter } from "events";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";

/**
 * Live events (new message, typing, read, notification) over Postgres
 * LISTEN/NOTIFY, so it works across several server instances with no extra
 * service. Each server process keeps one listening connection and fans events
 * out to its connected browsers. Events carry IDs only; clients refetch.
 *
 * LISTEN needs a direct (session) connection: if DATABASE_URL goes through a
 * transaction-mode pooler, set REALTIME_DATABASE_URL to the direct URL.
 */

export type RealtimeEvent =
  | { type: "message"; matchId: string }
  | { type: "typing"; matchId: string }
  | { type: "read"; matchId: string }
  | { type: "notification" };

const CHANNEL = "oh_events";

type Envelope = { u: string; e: RealtimeEvent };

const globalForRealtime = globalThis as unknown as {
  ohRealtime?: { emitter: EventEmitter; ready: Promise<boolean> };
};

function connect(emitter: EventEmitter): Promise<boolean> {
  const url = process.env.REALTIME_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) return Promise.resolve(false);

  const client = new Client({ connectionString: url });
  const ready = client
    .connect()
    .then(() => client.query(`LISTEN ${CHANNEL}`))
    .then(() => true)
    .catch((err) => {
      console.warn("[realtime] listener unavailable:", err.message);
      return false;
    });

  client.on("notification", (msg) => {
    if (!msg.payload) return;
    try {
      const env = JSON.parse(msg.payload) as Envelope;
      emitter.emit(env.u, env.e);
    } catch {
      // Ignore malformed payloads.
    }
  });
  client.on("error", (err) => {
    console.warn("[realtime] connection lost, reconnecting:", err.message);
    client.end().catch(() => {});
    setTimeout(() => {
      if (globalForRealtime.ohRealtime) {
        globalForRealtime.ohRealtime.ready = connect(emitter);
      }
    }, 3000);
  });

  return ready;
}

function hub() {
  if (!globalForRealtime.ohRealtime) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalForRealtime.ohRealtime = { emitter, ready: Promise.resolve(false) };
    globalForRealtime.ohRealtime.ready = connect(emitter);
  }
  return globalForRealtime.ohRealtime;
}

/** Subscribe this process to one member's events. Returns an unsubscribe function. */
export async function subscribe(
  userId: string,
  handler: (event: RealtimeEvent) => void,
): Promise<{ live: boolean; unsubscribe: () => void }> {
  const h = hub();
  const live = await h.ready;
  h.emitter.on(userId, handler);
  return { live, unsubscribe: () => h.emitter.off(userId, handler) };
}

export async function publish(userId: string, event: RealtimeEvent) {
  const payload = JSON.stringify({ u: userId, e: event } satisfies Envelope);
  try {
    await prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${payload})`;
  } catch (err) {
    console.warn("[realtime] publish failed:", (err as Error).message);
  }
}
