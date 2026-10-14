"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { GettingStarted } from "@/components/getting-started";

type Post = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  author: { id: string; displayName: string };
};

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async (cursor?: string) => {
    const res = await fetch(
      `/api/feed${cursor ? `?cursor=${cursor}` : ""}`,
    ).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!data) {
      setLoadFailed(true);
      return;
    }
    setLoadFailed(false);
    setPosts((prev) => (cursor ? [...prev, ...data.posts] : data.posts));
    setNextCursor(data.nextCursor);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not post.");
      return;
    }
    setBody("");
    setError(null);
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/posts/${id}`, { method: "DELETE" });
    if (res.ok) setPosts((p) => p.filter((x) => x.id !== id));
  }

  return (
    <div className="max-w-2xl">
      <GettingStarted />
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Feed
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        Posts from people you&apos;ve liked or followed. Meet people in{" "}
        <Link href="/rooms" className="underline">
          rooms
        </Link>{" "}
        and follow the ones you click with.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Share something with your followers…"
          className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-coral-deep">{error}</p>}
        <Button type="submit" size="sm">
          Post
        </Button>
      </form>

      <ul className="mt-8 space-y-4">
        {posts.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border border-forest/10 bg-cream/70 p-4"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-forest">
                {p.author.displayName}
              </span>
              <span className="text-ink/70">
                {new Date(p.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-ink/85">{p.body}</p>
            {p.mine && (
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="mt-2 text-xs text-ink/70 hover:text-coral-deep"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      {!loaded && !loadFailed && (
        <p className="mt-8 text-sm text-ink/70">Loading…</p>
      )}
      {loadFailed && (
        <p role="alert" className="mt-8 text-sm text-coral-deep">
          Couldn&apos;t load the feed.{" "}
          <button
            type="button"
            onClick={() =>
              load(posts.length ? (nextCursor ?? undefined) : undefined)
            }
            className="underline"
          >
            Try again
          </button>
        </p>
      )}
      {loaded && posts.length === 0 && (
        <EmptyState
          title="Your feed is quiet for now"
          body="Posts from people you like or follow show up here. A few good ways to meet people:"
          actions={[
            { href: "/search", label: "Browse people near you" },
            { href: "/rooms", label: "Chat in a room" },
            { href: "/events", label: "Find a munch or event" },
          ]}
        />
      )}
      {nextCursor && (
        <Button
          type="button"
          variant="ghost"
          className="mt-6"
          onClick={() => load(nextCursor)}
        >
          Load more
        </Button>
      )}
    </div>
  );
}
