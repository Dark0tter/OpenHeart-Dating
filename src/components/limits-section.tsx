import type { Clash } from "@/lib/limits";
import { LEVEL_LABEL } from "@/lib/limits";

function LimitChips({
  title,
  hint,
  items,
  tone,
}: {
  title: string;
  hint: string;
  items: string[];
  tone: "hard" | "soft";
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium text-forest">
        {title} <span className="font-normal text-ink/70">— {hint}</span>
      </h3>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((t) => (
          <li
            key={t}
            className={
              tone === "hard"
                ? "rounded border border-coral-deep/40 bg-coral-deep/10 px-2 py-0.5 text-xs text-coral-deep"
                : "rounded border border-forest/25 px-2 py-0.5 text-xs text-forest"
            }
          >
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A member's boundaries, shown apart from their interests so they can't be missed. */
export function LimitsSection({
  hardLimits,
  softLimits,
  note,
}: {
  hardLimits: string[];
  softLimits: string[];
  note: string | null;
}) {
  if (hardLimits.length === 0 && softLimits.length === 0 && !note) return null;
  return (
    <section
      aria-labelledby="limits-heading"
      className="space-y-3 rounded-lg border border-forest/15 bg-cream/60 p-4"
    >
      <h2 id="limits-heading" className="font-medium text-forest">
        Limits
      </h2>
      <LimitChips
        title="Hard limits"
        hint="never, not negotiable"
        items={hardLimits}
        tone="hard"
      />
      <LimitChips
        title="Soft limits"
        hint="not for me, or only with a lot of trust and talking first"
        items={softLimits}
        tone="soft"
      />
      {note && (
        <div>
          <h3 className="text-sm font-medium text-forest">In their words</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink/85">{note}</p>
        </div>
      )}
    </section>
  );
}

function list(items: Clash[]) {
  return items
    .map((c) => `${c.kink} (${LEVEL_LABEL[c.interest].toLowerCase()})`)
    .join(", ");
}

/**
 * Compares the viewer's list with this member's, so both can see up front
 * where they'd need to talk, or where they simply aren't a fit.
 */
export function LimitsCheck({
  name,
  clashes,
}: {
  name: string;
  clashes: Clash[];
}) {
  const theirHard = clashes.filter(
    (c) => c.whose === "theirs" && c.limit === "hard",
  );
  const theirSoft = clashes.filter(
    (c) => c.whose === "theirs" && c.limit === "soft",
  );
  const yourHard = clashes.filter(
    (c) => c.whose === "yours" && c.limit === "hard",
  );
  const yourSoft = clashes.filter(
    (c) => c.whose === "yours" && c.limit === "soft",
  );
  const hard = theirHard.length + yourHard.length;

  if (clashes.length === 0) {
    return (
      <p className="rounded-md bg-mist px-3 py-2 text-sm text-forest">
        Limits check: nothing you&apos;re into is on {name}&apos;s limits, and
        nothing they&apos;re into is on yours.
      </p>
    );
  }

  return (
    <section
      aria-labelledby="limits-check-heading"
      className={
        hard > 0
          ? "space-y-2 rounded-md border border-coral-deep/40 bg-coral-deep/5 px-3 py-2 text-sm"
          : "space-y-2 rounded-md border border-forest/20 bg-mist px-3 py-2 text-sm"
      }
    >
      <h2 id="limits-check-heading" className="font-medium text-forest">
        Limits check
      </h2>
      <ul className="list-disc space-y-1 pl-5 text-ink/85">
        {theirHard.length > 0 && (
          <li>
            <strong className="text-coral-deep">
              {name}&apos;s hard limits
            </strong>{" "}
            include things you&apos;re into: {list(theirHard)}.
          </li>
        )}
        {yourHard.length > 0 && (
          <li>
            <strong className="text-coral-deep">Your hard limits</strong>{" "}
            include things {name} is into: {list(yourHard)}.
          </li>
        )}
        {theirSoft.length > 0 && (
          <li>
            {name}&apos;s soft limits include things you&apos;re into:{" "}
            {list(theirSoft)}.
          </li>
        )}
        {yourSoft.length > 0 && (
          <li>
            Your soft limits include things {name} is into: {list(yourSoft)}.
          </li>
        )}
      </ul>
      <p className="text-xs text-ink/70">
        {hard > 0
          ? "Hard limits aren't up for negotiation. If these matter to you, this may not be a match."
          : "Soft limits can be talked about, but never pushed."}
      </p>
    </section>
  );
}
