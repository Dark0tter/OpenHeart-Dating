import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { WaitlistForm } from "@/components/waitlist-form";
import { waitlistThreshold } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Waiting list — Kindred Kinks",
  description:
    "Get one email when Kindred Kinks has enough members near you. No spam, and we delete your address after.",
};

export default function WaitlistPage() {
  return (
    <div className="oh-atmosphere min-h-screen">
      <SiteHeader />
      <main
        id="main"
        className="mx-auto max-w-xl space-y-6 px-6 pb-20 pt-6 text-ink/85"
      >
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-forest">
          Not many people near you yet?
        </h1>
        <p>
          Kindred Kinks is growing one city at a time. Leave your email and
          we&apos;ll send you <strong>one</strong> email when there are{" "}
          {waitlistThreshold()} verified members in your city. Then we delete
          your address.
        </p>
        <p className="text-sm text-ink/70">
          Rather join now and be one of the first?{" "}
          <Link href="/register" className="text-forest underline">
            Create a free account
          </Link>
          . Early members help their city fill up faster.
        </p>
        <WaitlistForm />
      </main>
    </div>
  );
}
