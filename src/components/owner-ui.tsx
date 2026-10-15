import Link from "next/link";

export function Stat({
  label,
  value,
  hint,
  href,
  urgent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  urgent?: boolean;
}) {
  const body = (
    <>
      <span className="block text-3xl font-semibold text-forest">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-sm text-ink/70">{label}</span>
      {hint && <span className="block text-xs text-ink/60">{hint}</span>}
    </>
  );
  const cls = `block rounded-lg border p-4 ${
    urgent ? "border-coral bg-coral/10" : "border-forest/10 bg-cream/70"
  }`;
  return href ? (
    <Link href={href} className={`${cls} hover:shadow-sm`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-sm font-medium uppercase tracking-wide text-sage">
      {children}
    </h2>
  );
}

/** A plain bar chart with no chart library: one labelled bar per row. */
export function Bars({
  rows,
}: {
  rows: { label: string; value: number; note?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-ink/70">Nothing yet.</p>;
  }
  return (
    <ul className="mt-3 space-y-1">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-ink/70">{r.label}</span>
          <span className="h-3 flex-1 rounded bg-mist">
            <span
              className="block h-3 rounded bg-forest"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className="w-20 shrink-0 text-right tabular-nums">
            {r.value.toLocaleString()}
            {r.note && <span className="text-ink/60"> {r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";

export const shortDay = (d: Date) =>
  d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
