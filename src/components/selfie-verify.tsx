"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type State = {
  photoVerified: boolean;
  latest: {
    status: "PENDING" | "APPROVED" | "REJECTED";
    reviewNote: string | null;
  } | null;
  gesture: string;
};

export function SelfieVerify() {
  const [state, setState] = useState<State | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const res = await fetch("/api/verification/selfie");
    if (res.ok) setState(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !state) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("gesture", state.gesture);
    const res = await fetch("/api/verification/selfie", {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? data.message : (data.error ?? "Upload failed."));
    if (res.ok) load();
  }

  if (!state) return null;

  return (
    <section
      aria-labelledby="selfie-heading"
      className="space-y-3 rounded-lg border border-forest/10 bg-cream/60 p-4"
    >
      <h2 id="selfie-heading" className="font-medium text-forest">
        Photo verification
      </h2>
      {state.photoVerified ? (
        <p className="text-sm text-forest">
          Your photos are verified. Members see a &ldquo;Photo verified&rdquo;
          badge on your profile.
        </p>
      ) : state.latest?.status === "PENDING" ? (
        <p className="text-sm text-ink/70">
          Your selfie is waiting for a moderator. We&apos;ll delete it as soon
          as it&apos;s reviewed.
        </p>
      ) : (
        <>
          {state.latest?.status === "REJECTED" && (
            <p className="text-sm text-coral-deep">
              Your last selfie wasn&apos;t a match
              {state.latest.reviewNote ? `: ${state.latest.reviewNote}` : ""}.
              You can try again.
            </p>
          )}
          <p className="text-sm text-ink/70">
            Show members your photos are really you. Take a selfie doing this
            pose:
          </p>
          <p className="rounded-md bg-mist px-3 py-2 font-medium text-forest">
            {state.gesture}
          </p>
          <p className="text-xs text-ink/70">
            Only moderators see it, and it&apos;s deleted right after review.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            className="sr-only"
            id="selfie-upload"
            onChange={onFile}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Uploading…" : "Take or choose a selfie"}
          </Button>
        </>
      )}
      {msg && (
        <p role="status" className="text-sm text-forest">
          {msg}
        </p>
      )}
    </section>
  );
}
