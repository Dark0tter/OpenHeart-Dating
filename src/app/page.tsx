import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <div className="oh-atmosphere oh-grain relative min-h-screen overflow-hidden">
      <SiteHeader />

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-end px-6 pb-16 pt-8 md:justify-center md:px-10 md:pb-24">
        <div className="max-w-xl">
          <h1 className="animate-oh-rise font-[family-name:var(--font-fraunces)] text-5xl leading-[1.05] tracking-tight text-forest md:text-7xl">
            OpenHeart
          </h1>
          <p className="animate-oh-rise-delay mt-5 max-w-md text-lg leading-relaxed text-ink/75 md:text-xl">
            Dating, connection, identity, and kink without artificial paywalls.
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
        </div>
      </main>

      {/* Dominant visual plane — atmosphere as full-bleed hero */}
      <div
        aria-hidden
        className="animate-oh-pulse pointer-events-none absolute inset-0 -z-0"
      >
        <div className="absolute -right-24 top-10 h-[70vh] w-[70vw] max-w-3xl rounded-full bg-forest/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[40vh] w-full bg-gradient-to-t from-forest/15 to-transparent" />
      </div>

      <section className="relative z-10 border-t border-forest/10 bg-cream/40 px-6 py-16 md:px-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
            Built for privacy and consent
          </h2>
          <p className="mt-3 max-w-2xl text-ink/70">
            Public, limited, or incognito profiles. Explicit media hidden until
            you accept a consent request. Likes, messages, and matching stay
            free — always.
          </p>
        </div>
      </section>
    </div>
  );
}
