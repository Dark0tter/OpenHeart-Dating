"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEVEL_LABEL, type KinkLevel } from "@/lib/limits";

export type KinkCategory = {
  id: string;
  name: string;
  description: string | null;
  kinks: { id: string; name: string }[];
};

const LEVELS: KinkLevel[] = [
  "FAVORITE",
  "INTERESTED",
  "CURIOUS",
  "NO",
  "HARD_LIMIT",
];

const ON_STYLE: Record<KinkLevel, string> = {
  FAVORITE: "border-forest bg-forest text-cream",
  INTERESTED: "border-forest bg-forest/80 text-cream",
  CURIOUS: "border-sage bg-sage/30 text-forest",
  NO: "border-forest bg-cream text-forest ring-1 ring-forest",
  HARD_LIMIT: "border-coral-deep bg-coral-deep text-cream",
};

function LevelButtons({
  name,
  value,
  onChange,
}: {
  name: string;
  value: KinkLevel | undefined;
  onChange: (level: KinkLevel | null) => void;
}) {
  return (
    <div role="group" aria-label={name} className="flex flex-wrap gap-1">
      {LEVELS.map((l) => {
        const on = value === l;
        return (
          <button
            key={l}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : l)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              on
                ? ON_STYLE[l]
                : "border-forest/15 bg-cream/70 text-ink/70 hover:border-forest/40 hover:text-forest",
            )}
          >
            {LEVEL_LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}

function KinkRow({
  name,
  hint,
  value,
  onChange,
}: {
  name: string;
  hint?: string;
  value: KinkLevel | undefined;
  onChange: (level: KinkLevel | null) => void;
}) {
  return (
    <li className="flex flex-col gap-1.5 border-b border-forest/10 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-ink">
        {name}
        {hint && <span className="ml-2 text-xs text-ink/70">{hint}</span>}
      </span>
      <LevelButtons name={name} value={value} onChange={onChange} />
    </li>
  );
}

/**
 * Tap a level to set it, tap it again to clear. Only the open category is
 * rendered, so the full list stays quick on phones.
 */
export function KinkPicker({
  categories,
  value,
  onChange,
}: {
  categories: KinkCategory[];
  value: Record<string, KinkLevel>;
  onChange: (kinkId: string, level: KinkLevel | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [onlySet, setOnlySet] = useState(false);
  const setCount = Object.keys(value).length;

  const all = useMemo(
    () =>
      categories.flatMap((c) =>
        c.kinks.map((k) => ({ ...k, category: c.name })),
      ),
    [categories],
  );

  const q = query.trim().toLowerCase();
  const flat = q
    ? all.filter((k) => k.name.toLowerCase().includes(q)).slice(0, 60)
    : onlySet
      ? all.filter((k) => value[k.id])
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search interests</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/70"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${all.length} interests…`}
            className="h-11 w-full rounded-md border border-forest/15 bg-cream/80 pl-9 pr-3 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-forest">
          <input
            type="checkbox"
            checked={onlySet}
            onChange={(e) => setOnlySet(e.target.checked)}
          />
          Only what I&apos;ve set ({setCount})
        </label>
      </div>

      {flat ? (
        flat.length === 0 ? (
          <p className="text-sm text-ink/70">
            {q ? "Nothing matches that." : "You haven't set anything yet."}
          </p>
        ) : (
          <ul className="rounded-md border border-forest/10 bg-cream/50 px-3">
            {flat.map((k) => (
              <KinkRow
                key={k.id}
                name={k.name}
                hint={k.category}
                value={value[k.id]}
                onChange={(l) => onChange(k.id, l)}
              />
            ))}
          </ul>
        )
      ) : (
        <ul className="space-y-2">
          {categories.map((cat) => {
            const chosen = cat.kinks.filter((k) => value[k.id]).length;
            const isOpen = open === cat.id;
            const panelId = `kink-cat-${cat.id}`;
            return (
              <li
                key={cat.id}
                className="rounded-md border border-forest/10 bg-cream/50"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : cat.id)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left text-sm text-forest"
                >
                  <span className="font-medium">{cat.name}</span>
                  <span className="flex items-center gap-2 text-xs text-ink/70">
                    {chosen > 0 && `${chosen} set`}
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </span>
                </button>
                {isOpen && (
                  <div id={panelId} className="px-3 pb-2">
                    {cat.description && (
                      <p className="mb-1 rounded bg-mist px-2 py-1.5 text-xs text-forest">
                        {cat.description}
                      </p>
                    )}
                    <ul>
                      {cat.kinks.map((k) => (
                        <KinkRow
                          key={k.id}
                          name={k.name}
                          value={value[k.id]}
                          onChange={(l) => onChange(k.id, l)}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
