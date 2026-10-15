import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SponsorInquiryForm } from "@/components/sponsor-inquiry-form";

export const metadata: Metadata = {
  title: "Advertise with us — Kindred Kinks",
  description:
    "Reach LGBTQIA+ and kink-positive adults in your city with one small, clearly labelled listing. No tracking, no pop-ups.",
};

const POINTS = [
  {
    title: "Who you reach",
    body: "LGBTQIA+ and kink-positive adults. Every member has passed an 18+ ID check, and you can focus on one city or area.",
  },
  {
    title: "How it looks",
    body: "One small listing at the bottom of the page, labelled as a sponsor: your name, a short headline, a sentence, and a link. No pop-ups, video, or tracking pixels.",
  },
  {
    title: "What you get back",
    body: "Anonymous daily totals of views and clicks. We never share who saw or clicked your listing, and we never sell member data.",
  },
  {
    title: "Who fits",
    body: "Queer-owned and queer-friendly local businesses, bars and venues, health clinics, community groups, events, and adult shops (adult listings appear on the website only, never in the phone apps).",
  },
];

export default function AdvertisePage() {
  return (
    <div className="oh-atmosphere min-h-screen">
      <SiteHeader />
      <main
        id="main"
        className="mx-auto max-w-2xl space-y-8 px-6 pb-20 pt-6 text-ink/85"
      >
        <div>
          <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-forest">
            Advertise with Kindred Kinks
          </h1>
          <p className="mt-3">
            Kindred Kinks is a free, privacy-first dating and community site for
            LGBTQIA+ and kink-positive adults. Sponsors keep it free for
            everyone, so we keep ads respectful of our members.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {POINTS.map((p) => (
            <li
              key={p.title}
              className="rounded-lg border border-forest/10 bg-cream/70 p-4"
            >
              <h2 className="font-medium text-forest">{p.title}</h2>
              <p className="mt-1 text-sm">{p.body}</p>
            </li>
          ))}
        </ul>

        <section className="space-y-2 text-sm">
          <h2 className="font-medium text-forest">Pricing and rules</h2>
          <p>
            Listings are a flat monthly fee for your area: no bidding and no
            per-click charges. Tell us where you want to reach and we&apos;ll
            give you a price and our current member numbers there.
          </p>
          <p>
            A person reviews every listing before it appears. We don&apos;t
            accept escort services, pay-to-chat or cam sites, crypto or get-rich
            offers, or anything that conflicts with our{" "}
            <a href="/guidelines" className="text-forest underline">
              community guidelines
            </a>
            . We can pause any listing at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            Get in touch
          </h2>
          <SponsorInquiryForm />
        </section>
      </main>
    </div>
  );
}
