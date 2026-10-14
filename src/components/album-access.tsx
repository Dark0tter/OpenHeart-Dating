"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Person = { id: string; displayName: string; photo: string | null };
type Scope = "PRIVATE_ALBUM" | "ADULT_ALBUM";

const SCOPE_LABEL: Record<Scope, string> = {
  PRIVATE_ALBUM: "private photos",
  ADULT_ALBUM: "adult photos",
};

function Avatar({ p }: { p: Person }) {
  return p.photo ? (
    <Image
      src={p.photo}
      alt=""
      width={36}
      height={36}
      unoptimized
      className="h-9 w-9 rounded-full object-cover"
    />
  ) : (
    <span aria-hidden className="h-9 w-9 rounded-full bg-mist" />
  );
}

export function AlbumAccess() {
  const [data, setData] = useState<{
    incoming: { id: string; scope: Scope; from: Person }[];
    sharedWith: { scope: Scope; viewer: Person }[];
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/consent");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function post(body: object) {
    await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  if (!data) return null;

  return (
    <section aria-labelledby="album-heading" className="space-y-4">
      <div>
        <h2 id="album-heading" className="font-medium text-forest">
          Private photo access
        </h2>
        <p className="text-sm text-ink/70">
          Nobody sees your private or adult photos unless you say yes. You can
          take access back at any time.
        </p>
      </div>

      {data.incoming.length > 0 && (
        <ul className="space-y-2">
          {data.incoming.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 rounded-md bg-mist/60 p-2 text-sm"
            >
              <Avatar p={r.from} />
              <span className="min-w-0 flex-1">
                <Link
                  href={`/members/${r.from.id}`}
                  className="font-medium text-forest underline"
                >
                  {r.from.displayName}
                </Link>{" "}
                asked to see your {SCOPE_LABEL[r.scope]}.
              </span>
              <Button
                size="sm"
                onClick={() =>
                  post({ action: "respond", requestId: r.id, accept: true })
                }
              >
                Allow
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  post({ action: "respond", requestId: r.id, accept: false })
                }
              >
                Decline
              </Button>
            </li>
          ))}
        </ul>
      )}

      {data.sharedWith.length > 0 ? (
        <ul className="space-y-2">
          {data.sharedWith.map((g) => (
            <li
              key={`${g.viewer.id}-${g.scope}`}
              className="flex items-center gap-3 text-sm"
            >
              <Avatar p={g.viewer} />
              <span className="min-w-0 flex-1">
                {g.viewer.displayName} can see your {SCOPE_LABEL[g.scope]}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  post({
                    action: "revoke",
                    otherUserId: g.viewer.id,
                    scope: g.scope,
                  })
                }
              >
                Remove access
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        data.incoming.length === 0 && (
          <p className="text-sm text-ink/70">
            You haven&apos;t shared private photos with anyone.
          </p>
        )
      )}
    </section>
  );
}
