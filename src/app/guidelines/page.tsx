import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Community guidelines — OpenHeart",
};

const WELCOME = [
  "Dating, relationships, and friendship",
  "Community events, munches, and local meetups",
  "Educational resources and support groups",
  "Sharing your hobbies, art, or personal site when you're not selling anything",
  "Planning dates, and exchanging gifts once you've actually met",
];

const NOT_ALLOWED = [
  "Amazon, Throne, or any other wishlists and gift registries",
  "Cash App, Venmo, PayPal, Zelle, or other payment requests",
  "Buy Me a Coffee, Ko-fi, or other tip jars",
  "Promoting OnlyFans, Fansly, or other paid-content subscriptions",
  "\"Spoil me\" profiles or repeated requests for money or gifts",
  "Escort advertising, spam, affiliate or recruitment schemes, and scams",
];

export default function GuidelinesPage() {
  return (
    <div className="oh-atmosphere min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-6 pb-20 pt-6">
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-forest">
          Community guidelines
        </h1>
        <p className="mt-4 text-lg text-ink/75">
          We&apos;re here for connection, not monetization. If you&apos;d like
          a gift from someone, get to know them first: meet for coffee.
        </p>

        <h2 className="mt-10 font-[family-name:var(--font-fraunces)] text-2xl text-forest">
          Welcome here
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink/85">
          {WELCOME.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="mt-10 font-[family-name:var(--font-fraunces)] text-2xl text-forest">
          Not allowed: financial solicitation
        </h2>
        <p className="mt-3 text-ink/75">
          Members may not request, advertise, or solicit money, gifts,
          wishlists, donations, sponsorships, or other financial benefits from
          other members, or direct them to paid content.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink/85">
          {NOT_ALLOWED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="mt-10 font-[family-name:var(--font-fraunces)] text-2xl text-forest">
          How we enforce it
        </h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink/85">
          <li>Content with payment links or wishlists isn&apos;t posted, and a moderator reviews it.</li>
          <li>Warning.</li>
          <li>Temporary suspension.</li>
          <li>Permanent ban for repeated violations.</li>
          <li>
            Verification-based ban for scams or deliberate commercial abuse, so
            the same person can&apos;t simply sign up again.
          </li>
        </ol>
        <p className="mt-3 text-ink/75">
          A person reviews every suspension and ban, and every one can be
          appealed.
        </p>

        <p className="mt-12 text-sm text-ink/55">
          See also our{" "}
          <Link href="/privacy" className="underline">
            privacy promise
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
