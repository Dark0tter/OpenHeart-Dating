import Link from "next/link";

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
          className="font-[family-name:var(--font-fraunces)] text-3xl text-forest"
        >
          OpenHeart
        </Link>
        {subtitle && <p className="mt-2 text-sm text-ink/70">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}
