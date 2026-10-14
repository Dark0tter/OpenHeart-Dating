"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

type Person = {
  userId: string;
  displayName: string;
  age: number;
  photo: string | null;
  likedAt: string;
};

export default function LikesPage() {
  const router = useRouter();
  const [likedYou, setLikedYou] = useState<Person[]>([]);
  const [youLiked, setYouLiked] = useState<Person[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/likes").catch(() => null);
    if (!res?.ok) {
      setStatus("error");
      return;
    }
    const d = await res.json();
    setLikedYou(d.likedYou);
    setYouLiked(d.youLiked);
    setStatus("ready");
  }

  useEffect(() => {
    load();
  }, []);

  async function likeBack(p: Person) {
    const res = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: p.userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.match?.id) {
      router.push(`/messages/${data.match.id}`);
      return;
    }
    setMsg(res.ok ? null : (data.error ?? "Couldn't send that like."));
    load();
  }

  async function takeBack(p: Person) {
    const res = await fetch("/api/likes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: p.userId }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(
      res.ok
        ? `Like for ${p.displayName} taken back.`
        : (data.error ?? "Couldn't undo that like."),
    );
    load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Likes
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        See who likes you for free. Like them back and you&apos;ll match.
      </p>
      {msg && (
        <p role="status" className="mt-3 text-sm text-forest">
          {msg}
        </p>
      )}

      {status === "loading" && (
        <p className="mt-6 text-sm text-ink/70">Loading…</p>
      )}
      {status === "error" && (
        <p role="alert" className="mt-6 text-sm text-coral-deep">
          Couldn&apos;t load your likes.{" "}
          <button type="button" onClick={load} className="underline">
            Try again
          </button>
        </p>
      )}

      {status === "ready" && (
        <>
          <section className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wide text-sage">
              Liked you
            </h2>
            {likedYou.length === 0 ? (
              <EmptyState
                className="mt-3"
                title="No new likes yet"
                body="A full profile with a photo and a few interests helps people find you."
                actions={[{ href: "/profile", label: "Edit your profile" }]}
              />
            ) : (
              <PersonList
                people={likedYou}
                action={(p) => (
                  <Button type="button" size="sm" onClick={() => likeBack(p)}>
                    Like back
                  </Button>
                )}
              />
            )}
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wide text-sage">
              You liked
            </h2>
            {youLiked.length === 0 ? (
              <p className="mt-3 text-sm text-ink/70">
                Nobody waiting on a reply.{" "}
                <Link href="/search" className="underline">
                  Find people
                </Link>
              </p>
            ) : (
              <PersonList
                people={youLiked}
                action={(p) => (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => takeBack(p)}
                  >
                    Undo like
                  </Button>
                )}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PersonList({
  people,
  action,
}: {
  people: Person[];
  action: (p: Person) => React.ReactNode;
}) {
  return (
    <ul className="mt-3 divide-y divide-forest/10">
      {people.map((p) => (
        <li key={p.userId} className="flex items-center gap-3 py-3">
          <Link
            href={`/members/${p.userId}`}
            className="flex min-w-0 flex-1 items-center gap-3 hover:underline"
          >
            <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-sage/40 to-forest/30">
              {p.photo && (
                <Image
                  src={p.photo}
                  alt=""
                  fill
                  unoptimized
                  sizes="48px"
                  className="object-cover"
                />
              )}
            </span>
            <span className="truncate font-medium text-ink">
              {p.displayName}, {p.age}
            </span>
          </Link>
          {action(p)}
        </li>
      ))}
    </ul>
  );
}
