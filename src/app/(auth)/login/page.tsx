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
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      botToken: botToken(fd) ?? "",
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
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
      <BotCheck />
      {error && (
        <p role="alert" className="text-sm text-coral-deep">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Log in"}
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
