"use client";

import { FormEvent, useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  finishTwoStep,
  newRecoveryCodes,
  startTwoStep,
  turnOffTwoStep,
} from "@/app/(app)/settings/two-step/actions";

function RecoveryCodes({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-forest/15 bg-cream/70 p-4">
      <h2 className="font-medium text-forest">Save your recovery codes</h2>
      <p className="text-sm text-ink/70">
        If you lose your phone, each of these lets you sign in once. Write them
        down or save them in a password manager. They won&apos;t be shown again.
      </p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((c) => (
          <li key={c} className="rounded bg-mist px-2 py-1 text-center">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}
        >
          Copy codes
        </Button>
        <Button type="button" onClick={onDone}>
          I&apos;ve saved them
        </Button>
      </div>
    </div>
  );
}

function CodeForm({
  label,
  button,
  danger,
  onCode,
}: {
  label: string;
  button: string;
  danger?: boolean;
  onCode: (code: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = e.currentTarget;
    await onCode(String(new FormData(form).get("code") ?? ""));
    setBusy(false);
    form.reset();
  }
  const id = `code-${button.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={20}
          className="max-w-40"
        />
        <Button
          type="submit"
          variant={danger ? "ghost" : "secondary"}
          disabled={busy}
        >
          {button}
        </Button>
      </div>
    </form>
  );
}

export function TwoStepManager({
  enabled,
  enabledOn,
  codesLeft,
  staff,
}: {
  enabled: boolean;
  enabledOn: string | null;
  codesLeft: number;
  staff: boolean;
}) {
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(
    null,
  );
  const [codes, setCodes] = useState<string[] | null>(null);
  const [afterCodes, setAfterCodes] = useState<"signout" | "stay">("stay");
  const [error, setError] = useState<string | null>(null);

  if (codes) {
    return (
      <RecoveryCodes
        codes={codes}
        onDone={() => {
          if (afterCodes === "signout") {
            void signOut({ callbackUrl: "/login?two_step=on" });
          } else {
            setCodes(null);
          }
        }}
      />
    );
  }

  const errorBox = error && (
    <p role="alert" className="text-sm text-coral-deep">
      {error}
    </p>
  );

  if (enabled) {
    return (
      <div className="space-y-6">
        <p className="rounded-md bg-mist px-3 py-2 text-sm text-forest">
          On since {enabledOn}. You have {codesLeft} unused recovery code
          {codesLeft === 1 ? "" : "s"}.
        </p>
        {errorBox}
        <CodeForm
          label="New recovery codes (enter a code from your app)"
          button="Make new codes"
          onCode={async (code) => {
            setError(null);
            const res = await newRecoveryCodes(code);
            if (!res.ok) return setError(res.error);
            setAfterCodes("stay");
            setCodes(res.codes);
          }}
        />
        {staff ? (
          <p className="text-sm text-ink/70">
            Staff accounts must keep two-step sign-in on.
          </p>
        ) : (
          <CodeForm
            label="Turn off two-step sign-in (enter a code from your app)"
            button="Turn off"
            danger
            onCode={async (code) => {
              setError(null);
              const res = await turnOffTwoStep(code);
              if (!res.ok) return setError(res.error);
              await signOut({ callbackUrl: "/login?two_step=off" });
            }}
          />
        )}
      </div>
    );
  }

  if (!setup) {
    return (
      <div className="space-y-3">
        {errorBox}
        <Button
          type="button"
          onClick={async () => {
            setError(null);
            const res = await startTwoStep();
            if (!res.ok) return setError(res.error);
            setSetup({ secret: res.secret, qr: res.qr });
          }}
        >
          Set up two-step sign-in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink/80">
        <li>Open your authenticator app and add a new account.</li>
        <li>Scan this code, or type the key below.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={setup.qr}
        alt="QR code for your authenticator app"
        width={220}
        height={220}
        className="rounded-md border border-forest/15 bg-white p-2"
      />
      <p className="text-sm">
        Key:{" "}
        <code className="select-all break-all rounded bg-mist px-1.5 py-0.5 font-mono">
          {setup.secret.match(/.{1,4}/g)?.join(" ")}
        </code>
      </p>
      {errorBox}
      <CodeForm
        label="Code from your app"
        button="Turn on"
        onCode={async (code) => {
          setError(null);
          const res = await finishTwoStep(code);
          if (!res.ok) return setError(res.error);
          setAfterCodes("signout");
          setCodes(res.codes);
        }}
      />
      <p className="text-sm text-ink/70">
        Turning it on signs you out everywhere, so you&apos;ll sign in once more
        with a code.
      </p>
    </div>
  );
}
