"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

type Item = {
  id: string;
  message: string;
  linkUrl: string | null;
  linkLabel: string | null;
  tone: string;
};

const KEY = "oh-dismissed-announcements";

function dismissed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Owner announcements. Dismissals are remembered on this device only. */
export function AnnouncementBar({ items }: { items: Item[] }) {
  const [hidden, setHidden] = useState<string[] | null>(null);
  useEffect(() => setHidden(dismissed()), []);
  if (!hidden) return null;
  const visible = items.filter((i) => !hidden.includes(i.id));
  if (visible.length === 0) return null;

  function dismiss(id: string) {
    const next = [...dismissed(), id].slice(-20);
    localStorage.setItem(KEY, JSON.stringify(next));
    setHidden(next);
  }

  return (
    <div role="region" aria-label="Announcements">
      {visible.map((a) => (
        <div
          key={a.id}
          className={`flex items-start justify-center gap-3 px-4 py-2 text-sm ${
            a.tone === "warning"
              ? "bg-coral/15 text-coral-deep"
              : "bg-mist text-forest"
          }`}
        >
          <p className="text-center">
            {a.message}
            {a.linkUrl && (
              <>
                {" "}
                {a.linkUrl.startsWith("/") ? (
                  <Link href={a.linkUrl} className="font-medium underline">
                    {a.linkLabel ?? "Learn more"}
                  </Link>
                ) : (
                  <a
                    href={a.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    {a.linkLabel ?? "Learn more"}
                  </a>
                )}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => dismiss(a.id)}
            aria-label="Dismiss announcement"
            className="shrink-0 rounded p-0.5 hover:bg-forest/10"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
