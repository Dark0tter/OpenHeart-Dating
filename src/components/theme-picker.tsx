"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  FLAG_THEMES,
  flagSwatch,
  THEME_MODES,
  type ThemeMode,
} from "@/lib/themes";

const MODE_LABELS: Record<ThemeMode, string> = {
  system: "Match my device",
  light: "Light",
  dark: "Dark",
};

export function ThemePicker({
  initialMode,
  initialFlag,
}: {
  initialMode: ThemeMode;
  initialFlag: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [flag, setFlag] = useState<string | null>(initialFlag);
  const [saving, setSaving] = useState(false);

  async function save(next: {
    themeMode?: ThemeMode;
    themeFlag?: string | null;
  }) {
    setSaving(true);
    const res = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setSaving(false);
    if (res.ok) router.refresh();
  }

  return (
    <fieldset className="space-y-4" disabled={saving}>
      <legend className="font-medium text-forest">Theme</legend>
      <p className="text-sm text-ink/60">
        Saved to your account, so it&apos;s the same on the website and in the
        apps.
      </p>

      <div className="flex flex-wrap gap-2">
        {THEME_MODES.map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              save({ themeMode: m });
            }}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              mode === m
                ? "bg-forest text-cream"
                : "bg-mist text-forest hover:bg-sage/30",
            )}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm text-ink/70">Pride flag accent</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          <FlagOption
            label="None"
            selected={flag === null}
            onSelect={() => {
              setFlag(null);
              save({ themeFlag: null });
            }}
          />
          {FLAG_THEMES.map((f) => (
            <FlagOption
              key={f.id}
              label={f.label}
              swatch={flagSwatch(f)}
              selected={flag === f.id}
              onSelect={() => {
                setFlag(f.id);
                save({ themeFlag: f.id });
              }}
            />
          ))}
        </div>
      </div>
    </fieldset>
  );
}

function FlagOption({
  label,
  swatch,
  selected,
  onSelect,
}: {
  label: string;
  swatch?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-md border p-2 text-left text-xs transition-colors",
        selected
          ? "border-forest ring-2 ring-forest/40"
          : "border-forest/15 hover:border-forest/40",
      )}
    >
      <span
        aria-hidden
        className="h-6 w-full rounded-sm border border-ink/10 bg-mist"
        style={swatch ? { background: swatch } : undefined}
      />
      <span className="text-ink">{label}</span>
    </button>
  );
}
