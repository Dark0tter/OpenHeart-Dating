"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { BotCheck, botToken } from "@/components/bot-check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      dateOfBirth: String(fd.get("dateOfBirth")),
      displayName: String(fd.get("displayName")),
      acceptTerms: fd.get("acceptTerms") === "on",
      botToken: botToken(fd),
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Registration failed");
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });
    router.push("/onboarding");
  }

  return (
    <div className="oh-atmosphere flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-[family-name:var(--font-fraunces)] text-3xl text-forest"
        >
          <BrandMark className="h-9 w-9" />
          Kindred Kinks
        </Link>
        <p className="mt-2 text-sm text-ink/70">
          18+ only. Email, password, and date of birth required.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              name="displayName"
              required
              maxLength={40}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
            />
          </div>
          <div>
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
          </div>
          <label className="flex items-start gap-2 text-sm text-ink/80">
            <input
              type="checkbox"
              name="acceptTerms"
              required
              className="mt-1"
            />
            <span>
              I&apos;m 18 or older and agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="text-forest underline"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/guidelines"
                target="_blank"
                className="text-forest underline"
              >
                Community Guidelines
              </Link>
              . Kindred Kinks has zero tolerance for abusive users and
              objectionable content.
            </span>
          </label>
          <BotCheck />
          {error && (
            <p role="alert" className="text-sm text-coral-deep">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Continue"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-ink/70">
          Already have an account?{" "}
          <Link href="/login" className="text-forest underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
