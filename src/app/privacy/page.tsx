import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Privacy promise — Kindred Kinks",
};

export default function PrivacyPage() {
  return (
    <div className="oh-atmosphere min-h-screen">
      <SiteHeader />
      <main id="main" className="mx-auto max-w-2xl px-6 pb-20 pt-6">
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-forest">
          Our privacy promise
        </h1>
        <p className="mt-4 text-lg text-ink/75">
          Members are the customers, not the product. Kindred Kinks only uses
          what you choose to tell it.
        </p>

        <ul className="mt-8 space-y-2 text-ink/85">
          <li>We never sell your personal information.</li>
          <li>We never share your identity with sponsors or advertisers.</li>
          <li>Sponsors never learn who saw or clicked their listing.</li>
          <li>We don&apos;t track you across other websites.</li>
          <li>
            We don&apos;t use third-party ad trackers, pixels, or
            fingerprinting.
          </li>
          <li>We don&apos;t build behavioral or shadow profiles.</li>
        </ul>

        <h2 className="mt-12 font-[family-name:var(--font-fraunces)] text-2xl text-forest">
          The sponsor block
        </h2>
        <p className="mt-3 text-ink/75">
          Every member sees one small, labelled block at the bottom of the page.
          It never pops up, plays video, or covers what you&apos;re doing. By
          default it shows general community listings. If you choose to in
          Settings, it can match listings to the interests and relationship
          goals on your profile instead, and it will never show something you
          marked as a No or Hard Limit. It never uses your browsing, searches,
          messages, or device. Donors can turn it off on the website.
        </p>
        <p className="mt-3 text-ink/75">
          Sponsors are approved by a person before they appear. It only appears
          on a few pages (home, search, the rooms list, events, and your own
          profile) — never in messages, room chats, signup, safety pages, or
          next to another member&apos;s profile. In the iPhone and Android apps
          it only shows listings approved as suitable for everyone. Sponsors get
          anonymous daily totals of how many times their listing was shown and
          clicked. To avoid repeats, your browser keeps a small cookie counting
          how often you&apos;ve seen each listing today; that count stays on
          your device.
        </p>

        <h2 className="mt-12 font-[family-name:var(--font-fraunces)] text-2xl text-forest">
          What we do keep
        </h2>
        <p className="mt-3 text-ink/75">
          To run the service and keep members safe we keep your account details,
          your profile, your messages, your login session, and when you were
          last active. Age verification is handled by a verification provider;
          we keep the result, never your ID images, and we ask the provider to
          delete them once the check is done. If an account is permanently
          banned, we keep a one-way scrambled code of its email and verified
          name and birthdate, so the same person can&apos;t rejoin; the code
          can&apos;t be turned back into those details.
        </p>
        <p className="mt-3 text-ink/75">
          We don&apos;t hold on to things nobody needs. Posts and room messages
          you delete are erased for good after 30 days, chats after an unmatch
          after 30 days, call history after 90 days, and sign-ups that never
          confirmed their email and haven&apos;t been back in 30 days are
          deleted. Anything tied to an open safety report is kept until the
          report is settled.
        </p>
        <p className="mt-3 text-ink/75">
          Profiles and messages are automatically checked for payment links,
          wishlists, and paid-content promotion. Matching content is not posted,
          and a note goes to our moderation team for review.
        </p>
        <p className="mt-3 text-ink/75">
          If you join the waiting list, we keep only your email and city. We
          delete it if you don&apos;t confirm within a week, and right after we
          send the one email telling you your city is ready. Businesses that ask
          about sponsoring give us their contact details so we can reply; we
          delete closed inquiries after a year.
        </p>
        <p className="mt-3 text-ink/75">
          You can turn on two-step sign-in in Settings. We store your
          authenticator key encrypted, and recovery codes only in scrambled
          form.
        </p>

        <p className="mt-12 text-sm text-ink/70">
          See also our{" "}
          <Link href="/guidelines" className="underline">
            community guidelines
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
