import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { ContactLine } from "@/components/contact-line";

export const metadata: Metadata = {
  title: "Child safety standards — OpenHeart",
};

export default function ChildSafetyPage() {
  return (
    <div className="oh-atmosphere min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl space-y-8 px-6 pb-20 pt-6 text-ink/85">
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-forest">
          Child safety standards
        </h1>
        <p>
          OpenHeart is for adults only. We prohibit child sexual abuse and
          exploitation (CSAE) of any kind, and we work to keep minors off the
          platform entirely.
        </p>

        <section>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            What we prohibit
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Child sexual abuse material (CSAM) of any kind, real or generated
            </li>
            <li>Grooming, sexualizing, or soliciting minors</li>
            <li>Roleplay, interests, or content that sexualizes minors</li>
            <li>Accounts held by anyone under 18</li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            How we prevent it
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Date of birth checked at sign-up, and age verification before a
              profile goes live
            </li>
            <li>No interests or rooms that could sexualize minors</li>
            <li>Adult photos never shown in our mobile apps</li>
          </ul>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            Reporting
          </h2>
          <p className="mt-2">
            Anyone can report a member from the Settings page by choosing
            &quot;Underage user or child safety&quot;. These reports go to the
            top of our moderation queue. You can also contact our child-safety
            team directly at <ContactLine />.
          </p>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
            What we do
          </h2>
          <p className="mt-2">
            We remove CSAE content, permanently ban the accounts involved, keep
            the evidence the law requires, and report to the National Center for
            Missing &amp; Exploited Children (NCMEC) and the relevant
            authorities. We comply with all applicable child-safety laws.
          </p>
        </section>

        <p className="text-sm text-ink/55">
          See also our{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/guidelines" className="underline">
            Community Guidelines
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
