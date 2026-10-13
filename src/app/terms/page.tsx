import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ContactLine } from "@/components/contact-line";

export const metadata: Metadata = {
  title: "Terms of use — OpenHeart",
};

const PROHIBITED = [
  "Anything involving, depicting, or sexualizing minors. We remove it, ban the account, and report it to the authorities",
  "Sharing intimate images or personal information without the person's consent",
  "Harassment, threats, hate speech, or bullying",
  "Impersonation, catfishing, scams, or fake accounts",
  "Asking for money, gifts, or wishlists, or promoting paid content or escort services",
  "Promoting violence, self-harm, illegal drugs, or other illegal activity",
  "Spam or commercial recruitment",
];

export default function TermsPage() {
  return (
    <div className="oh-atmosphere min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl space-y-8 px-6 pb-20 pt-6 text-ink/85">
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-forest">
          Terms of use
        </h1>

        <section>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            Who can join
          </h2>
          <p className="mt-2">
            OpenHeart is for adults 18 and over. You must give your real date of
            birth and pass age verification before your profile goes live. One
            account per person.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            Zero tolerance
          </h2>
          <p className="mt-2">
            We have zero tolerance for objectionable content and abusive users.
            By joining, you agree not to post or send:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {PROHIBITED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2">
            See the{" "}
            <Link href="/guidelines" className="underline">
              Community Guidelines
            </Link>{" "}
            and{" "}
            <Link href="/child-safety" className="underline">
              Child Safety Standards
            </Link>{" "}
            for details.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            Reporting, blocking, and moderation
          </h2>
          <p className="mt-2">
            You can block anyone at any time, and blocking takes effect
            immediately. You can report any member from a chat room or from the
            Safety page. We review reports within 24 hours and remove violating
            content and accounts. Child-safety and emergency reports are handled
            first. Suspensions and bans are reviewed by a person and can be
            appealed.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            Mobile apps
          </h2>
          <p className="mt-2">
            The iPhone and Android apps show a limited version of OpenHeart.
            Some interests, rooms, and all adult photos are only available on
            the website.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            Your account and data
          </h2>
          <p className="mt-2">
            You can permanently delete your account at any time from the Safety
            page, on the website or in the app. See our{" "}
            <Link href="/privacy" className="underline">
              privacy promise
            </Link>{" "}
            for what we collect and why.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            Contact
          </h2>
          <p className="mt-2">
            Questions, appeals, or safety concerns: <ContactLine />.
          </p>
        </section>
      </main>
    </div>
  );
}
