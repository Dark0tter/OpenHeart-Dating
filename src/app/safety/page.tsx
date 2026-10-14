import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Safety tips — OpenHeart" };

const SECTIONS: { title: string; tips: string[] }[] = [
  {
    title: "Before you meet",
    tips: [
      "Keep chatting on OpenHeart until you trust someone. Scammers push to move to WhatsApp, Telegram or text quickly.",
      "A short video call is a good way to check someone is who their photos say.",
      "Look for the photo-verified badge, and be cautious with brand-new profiles that have one photo and little else.",
      "Never send money, gift cards, crypto or verification codes to someone you haven't met — no matter the story.",
      "You don't owe anyone your address, workplace, or last name before you're ready.",
    ],
  },
  {
    title: "Meeting up",
    tips: [
      "Meet somewhere public for the first time, and get there and back on your own.",
      "Tell a friend where you'll be, or set up a date check-in so someone is alerted if you don't check in.",
      "Keep your phone charged and your drink in sight.",
      "It's always OK to leave. You can end a date, a scene or a conversation at any time.",
    ],
  },
  {
    title: "Kink and consent",
    tips: [
      "Negotiate before anything happens: interests, limits, safewords and aftercare. Hard limits are never up for debate.",
      "Consent can be withdrawn at any moment, and being intoxicated means someone can't consent.",
      "First meetings with someone from the kink community are best at a munch — a casual meetup in a public place.",
      "Ask around: established community members and event hosts often know who has a good reputation.",
    ],
  },
  {
    title: "Privacy",
    tips: [
      "Your exact location is never shown — only an approximate distance. Incognito mode hides you from search entirely.",
      "Photos you upload have their location and camera data removed. Private and adult albums are only visible to people you approve.",
      "Think before sharing photos that show your face together with anything you'd want to keep private.",
    ],
  },
  {
    title: "If something goes wrong",
    tips: [
      "Block anyone who makes you uncomfortable — they won't be told, and you'll disappear from each other's view.",
      "Report harassment, threats, scams, underage users or non-consensual images. A real person reviews every report, and you'll hear back.",
      "If you're in immediate danger, contact local emergency services. In the US you can also call or text 988, or reach the National Sexual Assault Hotline at 1-800-656-4673 (RAINN).",
    ],
  },
];

export default function SafetyPage() {
  return (
    <div className="oh-atmosphere min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl space-y-8 px-6 pb-20 pt-6 text-ink/85">
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-forest">
          Dating safely
        </h1>
        <p>
          Most people on OpenHeart are here for the same reasons you are. These
          habits help keep it that way.
        </p>
        <p className="rounded-md bg-sage/15 px-4 py-3 text-forest">
          Going on a date?{" "}
          <Link href="/safety/check-in" className="font-medium underline">
            Set up a date check-in
          </Link>{" "}
          — if you don&apos;t check in on time, we&apos;ll email someone you
          trust.
        </p>
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
              {s.title}
            </h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              {s.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ))}
        <p className="text-sm text-ink/60">
          See also our{" "}
          <Link href="/guidelines" className="underline">
            community guidelines
          </Link>
          ,{" "}
          <Link href="/child-safety" className="underline">
            child safety standards
          </Link>{" "}
          and{" "}
          <Link href="/support" className="underline">
            support
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
