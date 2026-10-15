import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export function AuthShell({
  subtitle,
  children,
}: {
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="oh-atmosphere flex min-h-screen items-center justify-center px-4 py-12">
      <main id="main" className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-[family-name:var(--font-fraunces)] text-3xl text-forest"
        >
          <BrandMark className="h-16 w-8" />
          Kindred Kinks
        </Link>
        {subtitle && <p className="mt-2 text-sm text-ink/70">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}
