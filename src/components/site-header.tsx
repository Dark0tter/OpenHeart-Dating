import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { auth } from "@/lib/auth";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-5 md:px-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-[family-name:var(--font-fraunces)] text-2xl tracking-tight text-forest md:text-3xl"
      >
        <BrandMark className="h-8 w-8 md:h-9 md:w-9" />
        Kindred Kinks
      </Link>
      <nav className="flex items-center gap-3 text-sm md:gap-5">
        {session?.user ? (
          <>
            <Link href="/feed" className="text-forest/80 hover:text-ink">
              Feed
            </Link>
            <Link href="/rooms" className="text-forest/80 hover:text-ink">
              Rooms
            </Link>
            <Link href="/messages" className="text-forest/80 hover:text-ink">
              Messages
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
