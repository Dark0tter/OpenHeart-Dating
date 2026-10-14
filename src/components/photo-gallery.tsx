"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type GalleryPhoto = {
  id: string;
  src: string;
  thumb: string;
  visibility: string;
};

export type Gallery = {
  photos: GalleryPhoto[];
  lockedPrivate: number;
  lockedAdult: number;
};

export function PhotoGallery({
  ownerId,
  ownerName,
  gallery,
  requests,
  canRequestAdult,
}: {
  ownerId: string;
  ownerName: string;
  gallery: Gallery;
  requests: Partial<Record<"PRIVATE_ALBUM" | "ADULT_ALBUM", string>>;
  canRequestAdult: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [sent, setSent] = useState(requests);
  const [msg, setMsg] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open !== null && !d.open) d.showModal();
    if (open === null && d.open) d.close();
  }, [open]);

  async function requestAccess(scope: "PRIVATE_ALBUM" | "ADULT_ALBUM") {
    const res = await fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request", otherUserId: ownerId, scope }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? data.message : (data.error ?? "Request failed."));
    if (res.ok) setSent((s) => ({ ...s, [scope]: "PENDING" }));
  }

  const photos = gallery.photos;
  const current = open !== null ? photos[open] : null;

  const locked: {
    scope: "PRIVATE_ALBUM" | "ADULT_ALBUM";
    count: number;
    label: string;
  }[] = [
    {
      scope: "PRIVATE_ALBUM" as const,
      count: gallery.lockedPrivate,
      label: "private",
    },
    {
      scope: "ADULT_ALBUM" as const,
      count: canRequestAdult ? gallery.lockedAdult : 0,
      label: "adult",
    },
  ].filter((l) => l.count > 0);

  return (
    <section aria-label={`${ownerName}'s photos`} className="space-y-3">
      {photos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                className="relative block aspect-square w-full overflow-hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
              >
                <Image
                  src={p.thumb}
                  alt={`${ownerName}, photo ${i + 1} of ${photos.length}`}
                  fill
                  unoptimized
                  sizes="33vw"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/70">No photos to show yet.</p>
      )}

      {locked.map((l) => (
        <div
          key={l.scope}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-forest/10 bg-mist/60 px-3 py-2 text-sm"
        >
          <span>
            {l.count} {l.label} photo{l.count === 1 ? "" : "s"}. Only shown if{" "}
            {ownerName} says yes.
          </span>
          {sent[l.scope] === "PENDING" ? (
            <span className="text-ink/70">Request sent</span>
          ) : sent[l.scope] === "DENIED" ? (
            <span className="text-ink/70">They declined</span>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => requestAccess(l.scope)}
            >
              Ask to see
            </Button>
          )}
        </div>
      ))}
      {msg && (
        <p role="status" className="text-sm text-forest">
          {msg}
        </p>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        className="m-auto max-h-[90dvh] max-w-[95vw] rounded-lg bg-ink p-0 backdrop:bg-ink/80"
        aria-label="Photo viewer"
      >
        {current && (
          <div className="relative">
            <Image
              src={current.src}
              alt={`${ownerName}, photo ${open! + 1} of ${photos.length}`}
              width={1200}
              height={1200}
              unoptimized
              className="max-h-[85dvh] w-auto object-contain"
            />
            <div className="flex items-center justify-between gap-2 p-2 text-sm text-cream">
              <button
                type="button"
                disabled={open === 0}
                onClick={() => setOpen((o) => (o ? o - 1 : 0))}
                className="rounded px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded px-3 py-2"
              >
                Close
              </button>
              <button
                type="button"
                disabled={open === photos.length - 1}
                onClick={() =>
                  setOpen((o) => Math.min((o ?? 0) + 1, photos.length - 1))
                }
                className="rounded px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
