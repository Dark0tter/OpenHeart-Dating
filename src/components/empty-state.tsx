import Link from "next/link";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  body,
  actions = [],
  className,
}: {
  title: string;
  body: string;
  actions?: { href: string; label: string }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mt-8 rounded-lg border border-dashed border-forest/20 bg-cream/50 px-5 py-8 text-center",
        className,
      )}
    >
      <p className="font-[family-name:var(--font-fraunces)] text-xl text-forest">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink/70">{body}</p>
      {actions.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {actions.map((a, i) => (
            <Link
              key={a.href}
              href={a.href}
              className={cn(
                "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors",
                i === 0
                  ? "bg-forest text-cream hover:bg-forest/90"
                  : "bg-mist text-forest hover:bg-sage/30",
              )}
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
