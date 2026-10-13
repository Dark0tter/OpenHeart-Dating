import Link from "next/link";
import { auth } from "@/lib/auth";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-5 md:px-10">
      <Link
        href="/"
        className="font-[family-name:var(--font-fraunces)] text-2xl tracking-tight text-forest md:text-3xl"
      >
        OpenHeart
      </Link>
      <nav className="flex items-center gap-3 text-sm md:gap-5">
        {session?.user ? (
          <>
            <Link href="/search" className="text-forest/80 hover:text-ink">
              Search
            </Link>
            <Link href="/matches" className="text-forest/80 hover:text-ink">
              Matches
            </Link>
            <Link href="/settings" className="text-forest/80 hover:text-ink">
              Settings
            </Link>
          </>
        ) : (
          <>
            <Link href="/login" className="text-forest/80 hover:text-ink">
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-coral px-4 py-2 text-cream hover:bg-coral-deep"
            >
              Join free
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
