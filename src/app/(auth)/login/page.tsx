"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { AuthShell } from "@/components/auth-shell";
import { BotCheck, botToken } from "@/components/bot-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERRORS: Record<string, string> = {
  rate_limited:
    "Too many sign-in attempts. Please wait 15 minutes and try again.",
  bot_check:
    "We couldn't confirm you're a person. Please refresh the page and try again.",
  two_step_invalid:
    "That code didn't work. Codes change every 30 seconds; try the newest one, or a recovery code.",
};

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsCode, setNeedsCode] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      botToken: botToken(fd) ?? "",
      code: String(fd.get("code") ?? ""),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      window.turnstile?.reset();
      if (res.code === "two_step") {
        setNeedsCode(true);
        return;
      }
      if (res.code === "two_step_invalid") setNeedsCode(true);
      setError((res.code && ERRORS[res.code]) ?? "Invalid email or password");
      return;
    }
    const next = params.get("next");
    router.push(
      next?.startsWith("/") && !next.startsWith("//") ? next : "/feed",
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      {params.get("two_step") === "on" && (
        <p
          role="status"
          className="rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          Two-step sign-in is on. Sign in again with a code from your app.
        </p>
      )}
      {params.get("two_step") === "off" && (
        <p
          role="status"
          className="rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          Two-step sign-in is off. Please sign in again.
        </p>
      )}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-sm text-forest underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {needsCode && (
        <div>
          <Label htmlFor="code">Code from your authenticator app</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={20}
          />
          <p className="mt-1 text-sm text-ink/70">
            Lost your phone? Enter one of your recovery codes instead.
          </p>
        </div>
      )}
      <BotCheck />
      {error && (
        <p role="alert" className="text-sm text-coral-deep">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : needsCode ? "Continue" : "Log in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell subtitle="Welcome back.">
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="mt-6 text-sm text-ink/70">
        New here?{" "}
        <Link href="/register" className="text-forest underline">
          Join free
        </Link>
      </p>
    </AuthShell>
  );
}
