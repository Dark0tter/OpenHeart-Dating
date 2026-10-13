"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MatchRow = {
  id: string;
  createdAt: string;
  lastMessage: { body: string | null } | null;
  otherUser: {
    id: string;
    displayName: string;
    age: number;
    photo: string | null;
  };
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<MatchRow[]>([]);

  useEffect(() => {
    fetch("/api/matches")
      .then((r) => r.json())
      .then((d) => setMatches(d.matches ?? []));
  }, []);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Matches
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Mutual likes create a match. Messaging is never paywalled.
      </p>
      <ul className="mt-8 divide-y divide-forest/10">
        {matches.map((m) => (
          <li key={m.id}>
            <Link
              href={`/messages/${m.id}`}
              className="flex items-center justify-between py-4 hover:bg-mist/40"
            >
              <div>
                <p className="font-medium text-ink">
                  {m.otherUser.displayName}, {m.otherUser.age}
                </p>
                <p className="text-sm text-ink/55 line-clamp-1">
                  {m.lastMessage?.body ?? "Say hello"}
                </p>
              </div>
              <span className="text-sm text-coral">Open</span>
            </Link>
          </li>
        ))}
      </ul>
      {matches.length === 0 && (
        <p className="mt-8 text-ink/55">No matches yet — keep discovering.</p>
      )}
    </div>
  );
}
