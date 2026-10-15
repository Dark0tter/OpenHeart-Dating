import Link from "next/link";
import {
  BadgeCheck,
  EyeOff,
  HandHeart,
  Lock,
  MessagesSquare,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const STEPS = [
  {
    title: "Make a free profile",
    body: "A few short steps: who you are, who you'd like to meet, and — if you want — your interests and limits.",
  },
  {
    title: "Verify you're 18+ once",
    body: "A quick, private check. We keep only the result, never your ID.",
  },
  {
    title: "Meet people your way",
    body: "Search nearby, chat in interest rooms, or find a local munch or event.",
  },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: HandHeart,
    title: "Free where it matters",
    body: "Likes, messages, search and matching are free. No paywall between you and a conversation.",
  },
  {
    icon: ShieldAlert,
    title: "Limits come first",
    body: "Mark soft and hard limits. People whose interests clash are warned before they reach out, and you can hide clashes in search.",
  },
  {
    icon: EyeOff,
    title: "You choose who sees you",
    body: "Public, limited to people looking for someone like you, or incognito until you make the first move.",
  },
  {
    icon: Lock,
    title: "Consent-first photos",
    body: "Private albums stay locked until you say yes. Photo location data is stripped automatically.",
  },
  {
    icon: MessagesSquare,
    title: "Community, not just swiping",
    body: "Rooms for shared interests and local munches make it easy to get to know people first.",
  },
  {
    icon: ShieldCheck,
    title: "Safety built in",
    body: "Date check-ins, one-tap block and report, and every member is age-verified.",
  },
];

function ProfilePreview() {
  return (
    <figure
      aria-label="Example profile showing the limits check"
      className="mx-auto w-full max-w-sm rounded-2xl border border-forest/15 bg-cream/90 p-5 shadow-xl shadow-forest/10"
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="h-14 w-14 rounded-full bg-gradient-to-br from-sage to-forest"
        />
        <div>
          <p className="flex items-center gap-1.5 font-medium text-forest">
            Sam, 31
            <BadgeCheck aria-hidden className="h-4 w-4 text-sage" />
            <span className="sr-only">photo verified</span>
          </p>
          <p className="text-sm text-ink/70">they/them · about 8 km away</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-ink/85">
        Bookshop wanderer, terrible at karaoke, great at aftercare. Looking for
        friends first and seeing where it goes.
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
        {["Rope", "Roleplay", "Cuddles", "Munches"].map((t) => (
          <span
            key={t}
            className="rounded-full bg-mist px-2.5 py-1 text-forest"
          >
            {t}
          </span>
        ))}
      </div>
      <div className="mt-4 rounded-lg border border-coral/40 bg-coral/10 p-3 text-sm">
        <p className="font-medium text-coral-deep">Before you say hi</p>
        <p className="mt-1 text-ink/85">
          &ldquo;Pain play&rdquo; is one of Sam&apos;s{" "}
          <strong>hard limits</strong>, and you marked it as Curious.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <span className="rounded-md bg-forest py-2 text-center font-medium text-cream">
          Like
        </span>
        <span className="rounded-md bg-mist py-2 text-center font-medium text-forest">
          Message
        </span>
      </div>
      <figcaption className="mt-3 text-center text-xs text-ink/70">
        Example profile
      </figcaption>
    </figure>
  );
}

export default function Home() {
  return (
    <div className="oh-atmosphere oh-grain relative min-h-screen overflow-hidden">
      <SiteHeader />

      <main id="main" className="relative z-10">
        <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-end gap-12 px-6 pb-16 pt-8 md:flex-row md:items-center md:justify-between md:px-10 md:pb-24">
          <div className="max-w-xl">
            <h1 className="animate-oh-rise font-[family-name:var(--font-fraunces)] text-5xl leading-[1.05] tracking-tight text-forest md:text-7xl">
              Kindred Kinks
            </h1>
            <p className="animate-oh-rise-delay mt-5 max-w-md text-lg leading-relaxed text-ink/75 md:text-xl">
              Dating and community for LGBTQIA+ and kink-curious adults — where
              your identity, interests and limits are respected from the first
              hello.
            </p>
            <div className="animate-oh-fade mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-md bg-coral px-6 py-3 text-sm font-medium text-cream transition-colors hover:bg-coral-deep"
              >
                Create free account
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-forest/20 bg-cream/50 px-6 py-3 text-sm font-medium text-forest backdrop-blur-sm transition-colors hover:bg-cream"
              >
                Log in
              </Link>
            </div>
            <p className="animate-oh-fade mt-4 text-sm text-ink/70">
              18+ only. Free to join. No ads that follow you around.
            </p>
          </div>
          <div className="animate-oh-fade hidden md:block md:w-[24rem]">
            <ProfilePreview />
          </div>
        </section>

        <section
          aria-labelledby="how-it-works"
          className="border-t border-forest/10 bg-cream/60 px-6 py-16 md:px-10"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="how-it-works"
              className="font-[family-name:var(--font-fraunces)] text-3xl text-forest"
            >
              How it works
            </h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li
                  key={s.title}
                  className="rounded-xl border border-forest/10 bg-cream/80 p-5"
                >
                  <span
                    aria-hidden
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-forest font-medium text-cream"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-medium text-forest">{s.title}</h3>
                  <p className="mt-1 text-sm text-ink/70">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="different"
          className="border-t border-forest/10 px-6 py-16 md:px-10"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="different"
              className="font-[family-name:var(--font-fraunces)] text-3xl text-forest"
            >
              What makes Kindred Kinks different
            </h2>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist text-forest">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-medium text-forest">{title}</h3>
                    <p className="mt-1 text-sm text-ink/70">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="limits-preview"
          className="border-t border-forest/10 bg-cream/60 px-6 py-16 md:hidden"
        >
          <h2
            id="limits-preview"
            className="mb-6 font-[family-name:var(--font-fraunces)] text-3xl text-forest"
          >
            Know before you say hi
          </h2>
          <ProfilePreview />
        </section>

        <section
          aria-labelledby="privacy"
          className="border-t border-forest/10 px-6 py-16 md:px-10"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="privacy"
              className="font-[family-name:var(--font-fraunces)] text-3xl text-forest"
            >
              Your data isn&apos;t the product
            </h2>
            <ul className="mt-3 max-w-2xl space-y-1 text-ink/70">
              <li>We do not track your activity across the web.</li>
              <li>We do not sell your personal information.</li>
              <li>We do not build behavioral advertising profiles.</li>
              <li>
                You&apos;ll see one small, labelled sponsor block: no pop-ups,
                no video, no tracking. It shows general listings unless you
                choose to match it to the interests on your profile.
              </li>
            </ul>
          </div>
        </section>

        <section className="border-t border-forest/10 bg-forest px-6 py-16 text-center md:px-10">
          <Sparkles aria-hidden className="mx-auto h-6 w-6 text-cream/80" />
          <h2 className="mt-3 font-[family-name:var(--font-fraunces)] text-3xl text-cream">
            Come as you are
          </h2>
          <p className="mx-auto mt-2 max-w-md text-cream/80">
            Setting up takes about five minutes, and you can skip anything you
            want to come back to.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="rounded-md bg-coral px-6 py-3 text-sm font-medium text-cream transition-colors hover:bg-coral-deep"
            >
              Create free account
            </Link>
            <Link
              href="/safety"
              className="inline-flex items-center gap-2 rounded-md border border-cream/30 px-6 py-3 text-sm font-medium text-cream transition-colors hover:bg-cream/10"
            >
              <ShieldCheck aria-hidden className="h-4 w-4" />
              Safety tips
            </Link>
          </div>
          <p className="mt-5 text-sm text-cream/80">
            Not many people near you yet?{" "}
            <Link href="/waitlist" className="underline hover:text-cream">
              Get one email when your city fills up
            </Link>
            .
          </p>
        </section>
      </main>

      <div
        aria-hidden
        className="animate-oh-pulse pointer-events-none absolute inset-0 -z-0"
      >
        <div className="absolute -right-24 top-10 h-[70vh] w-[70vw] max-w-3xl rounded-full bg-forest/10 blur-3xl" />
      </div>

      <footer className="relative z-10 border-t border-forest/10 bg-cream/60 px-6 py-8 md:px-10">
        <nav
          aria-label="About Kindred Kinks"
          className="mx-auto flex max-w-5xl flex-wrap gap-5 text-sm text-forest/80"
        >
          <Link href="/privacy" className="underline hover:text-ink">
            Privacy promise
          </Link>
          <Link href="/guidelines" className="underline hover:text-ink">
            Community guidelines
          </Link>
          <Link href="/safety" className="underline hover:text-ink">
            Safety tips
          </Link>
          <Link href="/terms" className="underline hover:text-ink">
            Terms
          </Link>
          <Link href="/child-safety" className="underline hover:text-ink">
            Child safety
          </Link>
          <Link href="/waitlist" className="underline hover:text-ink">
            Waiting list
          </Link>
          <Link href="/advertise" className="underline hover:text-ink">
            Advertise with us
          </Link>
        </nav>
      </footer>
    </div>
  );
}
