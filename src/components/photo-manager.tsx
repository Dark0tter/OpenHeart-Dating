"use client";

import Image from "next/image";
import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Visibility = "PUBLIC" | "MATCH_ONLY" | "PRIVATE" | "ADULT";

type OwnPhoto = {
  id: string;
  thumb: string;
  visibility: Visibility;
  isPrimary: boolean;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string | null;
};

const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "PUBLIC", label: "Everyone" },
  { value: "MATCH_ONLY", label: "Matches only" },
  { value: "PRIVATE", label: "Private album (by request)" },
  { value: "ADULT", label: "Adult album (website only)" },
];

const STATUS_TEXT = {
  PENDING: "Waiting for review",
  APPROVED: "Approved",
  REJECTED: "Not approved",
} as const;

export function PhotoManager({
  canAddAdult,
  adultAllowedHere,
}: {
  canAddAdult: boolean;
  adultAllowedHere: boolean;
}) {
  const [photos, setPhotos] = useState<OwnPhoto[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/photos");
    if (res.ok) setPhotos((await res.json()).photos);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("visibility", visibility);
    const res = await fetch("/api/photos", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    setMsg(res.ok ? data.message : (data.error ?? "Upload failed."));
    if (res.ok) load();
  }

  async function patch(id: string, body: object) {
    const res = await fetch(`/api/photos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data.error ?? "Couldn't save that change.");
    else if (data.needsReview) {
      setMsg(
        "Moved to everyone. It will show again once a moderator approves it.",
      );
    }
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
    load();
  }

  const options = VISIBILITY_OPTIONS.filter(
    (o) => o.value !== "ADULT" || (canAddAdult && adultAllowedHere),
  );

  return (
    <section aria-labelledby="photos-heading" className="space-y-4">
      <div>
        <h2 id="photos-heading" className="font-medium text-forest">
          Your photos
        </h2>
        <p className="text-sm text-ink/60">
          Up to 12. Location and camera details are removed from every photo.
          Your main photo must be visible to everyone and show your face.
        </p>
      </div>

      {msg && (
        <p
          role="status"
          className="rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {msg}
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => (
          <li
            key={p.id}
            className="overflow-hidden rounded-lg border border-forest/10 bg-cream/70"
          >
            <div className="relative aspect-square">
              <Image
                src={p.thumb}
                alt={p.isPrimary ? "Your main photo" : "Your photo"}
                fill
                unoptimized
                sizes="(min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
              {p.isPrimary && (
                <span className="absolute left-2 top-2 rounded bg-forest px-2 py-0.5 text-xs text-cream">
                  Main
                </span>
              )}
            </div>
            <div className="space-y-2 p-2 text-xs">
              {p.status && (
                <p
                  className={
                    p.status === "REJECTED"
                      ? "text-coral-deep"
                      : p.status === "PENDING"
                        ? "text-ink/60"
                        : "text-forest"
                  }
                >
                  {STATUS_TEXT[p.status]}
                  {p.status === "REJECTED" && p.rejectionReason
                    ? `: ${p.rejectionReason}`
                    : ""}
                </p>
              )}
              <label className="block">
                <span className="sr-only">Who can see this photo</span>
                <select
                  value={p.visibility}
                  onChange={(e) => patch(p.id, { visibility: e.target.value })}
                  className="h-9 w-full rounded border border-forest/15 bg-cream/80 px-2"
                >
                  {VISIBILITY_OPTIONS.filter(
                    (o) =>
                      o.value !== "ADULT" ||
                      canAddAdult ||
                      p.visibility === "ADULT",
                  ).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                {!p.isPrimary && p.visibility === "PUBLIC" && (
                  <button
                    type="button"
                    className="text-forest underline"
                    onClick={() => patch(p.id, { isPrimary: true })}
                  >
                    Make main
                  </button>
                )}
                <button
                  type="button"
                  className="ml-auto text-coral-deep underline"
                  onClick={() => remove(p.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {photos.length < 12 && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-ink/70">Add to</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              className="h-11 rounded-md border border-forest/15 bg-cream/80 px-3 text-sm"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif"
            className="sr-only"
            id="photo-upload"
            onChange={onFile}
          />
          <Button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Uploading…" : "Add a photo"}
          </Button>
        </div>
      )}
    </section>
  );
}
