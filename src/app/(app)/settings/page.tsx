"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const REASONS = [
  "HARASSMENT",
  "SPAM",
  "CATFISHING",
  "UNDERAGE",
  "THREATS",
  "FRAUD",
  "NON_CONSENSUAL_CONTENT",
  "FINANCIAL_SOLICITATION",
  "EMERGENCY",
  "OTHER",
] as const;

export default function SettingsPage() {
  const [blockId, setBlockId] = useState("");
  const [reportId, setReportId] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]>("HARASSMENT");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [adPreference, setAdPreference] = useState<string | null>(null);
  const [supporter, setSupporter] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d) => {
        setAdPreference(d.adPreference ?? "GENERIC");
        setSupporter(Boolean(d.isSupporter));
      });
  }, []);

  async function onAdPreference(value: string) {
    const res = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adPreference: value }),
    });
    const data = await res.json();
    if (res.ok) {
      setAdPreference(data.adPreference);
      setMsg("Sponsor preference saved.");
    } else {
      setMsg(data.error);
    }
  }

  async function onBlock(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: blockId }),
    });
    const data = await res.json();
    setMsg(res.ok ? "User blocked. Messages, likes, and match removed." : data.error);
  }

  async function onReport(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportedUserId: reportId,
        reason,
        details,
      }),
    });
    const data = await res.json();
    setMsg(
      res.ok
        ? `Report filed (${data.report.priority} priority).`
        : data.error,
    );
  }

  return (
    <div className="max-w-xl space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          Safety
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          Block immediately removes messages, likes, matching, and search
          visibility between you. Emergency reports enter the high-priority
          queue.
        </p>
      </div>

      {msg && (
        <p className="rounded-md bg-mist px-3 py-2 text-sm text-forest">{msg}</p>
      )}

      <fieldset className="space-y-2">
        <legend className="font-medium text-forest">Sponsor block</legend>
        <p className="text-sm text-ink/60">
          One small block at the bottom of the page. We never use your
          activity, browsing, or device data.{" "}
          <Link href="/privacy" className="underline">
            Our privacy promise
          </Link>
        </p>
        {[
          {
            value: "GENERIC",
            label: "General community listings only",
          },
          {
            value: "PROFILE_INTERESTS",
            label: "Match listings to the interests on my profile",
          },
          {
            value: "NONE",
            label: supporter
              ? "No sponsor block"
              : "No sponsor block (supporters)",
            disabled: !supporter,
          },
        ].map((o) => (
          <label
            key={o.value}
            className={`flex items-center gap-2 text-sm ${o.disabled ? "text-ink/40" : "text-ink"}`}
          >
            <input
              type="radio"
              name="adPreference"
              value={o.value}
              checked={adPreference === o.value}
              disabled={o.disabled || adPreference === null}
              onChange={() => onAdPreference(o.value)}
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      <form onSubmit={onBlock} className="space-y-3">
        <h2 className="font-medium text-forest">Block user</h2>
        <div>
          <Label htmlFor="blockId">User ID</Label>
          <Input
            id="blockId"
            value={blockId}
            onChange={(e) => setBlockId(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="danger">
          Block
        </Button>
      </form>

      <form onSubmit={onReport} className="space-y-3">
        <h2 className="font-medium text-forest">Report user</h2>
        <div>
          <Label htmlFor="reportId">User ID</Label>
          <Input
            id="reportId"
            value={reportId}
            onChange={(e) => setReportId(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="reason">Reason</Label>
          <select
            id="reason"
            value={reason}
            onChange={(e) =>
              setReason(e.target.value as (typeof REASONS)[number])
            }
            className="h-11 w-full rounded-md border border-forest/15 bg-cream/80 px-3 text-sm"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="details">Details</Label>
          <textarea
            id="details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" variant="secondary">
          Submit report
        </Button>
      </form>

      <Button type="button" variant="ghost" onClick={() => signOut({ callbackUrl: "/" })}>
        Sign out
      </Button>
    </div>
  );
}
