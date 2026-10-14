"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhotoGallery, type Gallery } from "@/components/photo-gallery";

type Member = {
  userId: string;
  isSelf: boolean;
  displayName: string;
  pronouns: string | null;
  age: number;
  bio: string | null;
  location: string | null;
  distance: string | null;
  activity: string;
  ageVerified: boolean;
  photoVerified: boolean;
  identity: string[];
  orientation: string[];
  goals: string[];
  relationshipStyles: string[];
  body: string[];
  accessibility: string[];
  kinks: {
    favorite: string[];
    interested: string[];
    curious: string[];
    hardLimits: string[];
  };
  prompts?: { question: string; answer: string }[];
};

type Data = {
  member: Member;
  gallery: Gallery;
  relationship: {
    youLiked: boolean;
    likedYou: boolean;
    matchId: string | null;
    following: boolean;
    albumRequests: Partial<Record<"PRIVATE_ALBUM" | "ADULT_ALBUM", string>>;
  };
  adultAllowedHere: boolean;
};

function Chips({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink/70">
        {title}
      </h3>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((t) => (
          <li
            key={t}
            className="rounded bg-mist px-2 py-0.5 text-xs text-forest"
          >
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MemberPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/members/${userId}`);
    const body = await res.json();
    if (!res.ok) setError(body.error ?? "This member isn't available.");
    else setData(body);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function call(url: string, init: RequestInit, ok: string) {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => ({}));
    setMsg(
      res.ok
        ? body.isMatch
          ? "It's a match! Messaging is free."
          : ok
        : (body.error ?? "Something went wrong."),
    );
    if (res.ok) load();
    return res.ok;
  }

  const json = (method: string, body: object): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  async function onMessage(e: FormEvent) {
    e.preventDefault();
    const sent = await call(
      "/api/message-requests",
      json("POST", { toUserId: userId, body: note }),
      "Message request sent. They'll see it in their Messages.",
    );
    if (sent) setNote("");
  }

  async function onBlock() {
    if (
      !confirm(
        `Block ${data?.member.displayName}? You'll disappear from each other's view.`,
      )
    )
      return;
    const ok = await call("/api/blocks", json("POST", { userId }), "Blocked.");
    if (ok) router.push("/search");
  }

  if (error) return <p className="text-ink/70">{error}</p>;
  if (!data) return <p className="text-ink/70">Loading…</p>;

  const m = data.member;
  const r = data.relationship;

  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          {m.displayName}, {m.age}
        </h1>
        <p className="text-sm text-ink/70">
          {[m.pronouns, m.location, m.distance, m.activity]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <ul className="flex flex-wrap gap-2 text-xs">
          {m.ageVerified && (
            <li className="rounded-full bg-forest px-2.5 py-1 text-cream">
              Age verified
            </li>
          )}
          {m.photoVerified && (
            <li className="rounded-full bg-forest px-2.5 py-1 text-cream">
              Photo verified
            </li>
          )}
          {r.likedYou && !r.matchId && (
            <li className="rounded-full bg-coral px-2.5 py-1 text-cream">
              Likes you
            </li>
          )}
        </ul>
      </header>

      <PhotoGallery
        ownerId={m.userId}
        ownerName={m.displayName}
        gallery={data.gallery}
        requests={r.albumRequests}
        canRequestAdult={data.adultAllowedHere}
      />

      {msg && (
        <p
          role="status"
          className="rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {msg}
        </p>
      )}

      {!m.isSelf && (
        <div className="flex flex-wrap gap-2">
          {r.matchId ? (
            <Link href={`/messages/${r.matchId}`}>
              <Button type="button">Message</Button>
            </Link>
          ) : (
            <Button
              type="button"
              disabled={r.youLiked}
              onClick={() =>
                call(
                  "/api/likes",
                  json("POST", { toUserId: userId }),
                  "Like sent.",
                )
              }
            >
              {r.youLiked ? "Liked" : "Like"}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              r.following
                ? call(
                    `/api/follows?userId=${userId}`,
                    { method: "DELETE" },
                    "Unfollowed.",
                  )
                : call(
                    "/api/follows",
                    json("POST", { userId }),
                    "Following. Their posts will show in your feed.",
                  )
            }
          >
            {r.following ? "Following" : "Follow"}
          </Button>
        </div>
      )}

      {m.prompts && m.prompts.length > 0 && (
        <section className="space-y-4">
          {m.prompts.map((p) => (
            <div
              key={p.question}
              className="rounded-lg border border-forest/10 bg-cream/60 p-4"
            >
              <h2 className="text-sm text-ink/70">{p.question}</h2>
              <p className="mt-1 whitespace-pre-wrap text-ink">{p.answer}</p>
            </div>
          ))}
        </section>
      )}

      {m.bio && (
        <section>
          <h2 className="font-medium text-forest">About</h2>
          <p className="mt-2 whitespace-pre-wrap text-ink/85">{m.bio}</p>
        </section>
      )}

      <section className="space-y-4">
        <Chips title="Identity" items={m.identity} />
        <Chips title="Orientation" items={m.orientation} />
        <Chips title="Looking for" items={m.goals} />
        <Chips title="Relationship style" items={m.relationshipStyles} />
        <Chips title="Body" items={m.body} />
        <Chips title="Accessibility" items={m.accessibility} />
        <Chips title="Favorite interests" items={m.kinks.favorite} />
        <Chips title="Into" items={m.kinks.interested} />
        <Chips title="Curious about" items={m.kinks.curious} />
        <Chips title="Hard limits" items={m.kinks.hardLimits} />
      </section>

      {!m.isSelf && !r.matchId && (
        <form onSubmit={onMessage} className="space-y-2">
          <label htmlFor="note" className="font-medium text-forest">
            Send a message request
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            required
            className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
            placeholder={`Say hi to ${m.displayName}…`}
          />
          <Button type="submit" variant="secondary">
            Send request
          </Button>
        </form>
      )}

      {!m.isSelf && (
        <footer className="flex flex-wrap gap-4 border-t border-forest/10 pt-4 text-sm">
          <Link
            href={`/settings?report=${m.userId}`}
            className="text-coral-deep underline"
          >
            Report
          </Link>
          <button
            type="button"
            onClick={onBlock}
            className="text-coral-deep underline"
          >
            Block
          </button>
        </footer>
      )}
    </article>
  );
}
