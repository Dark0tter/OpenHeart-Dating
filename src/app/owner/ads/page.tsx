import Link from "next/link";
import { Bars, pct, SectionTitle, shortDay, Stat } from "@/components/owner-ui";
import { adStats } from "@/lib/owner-stats";

export const dynamic = "force-dynamic";

const STATUS_CLS: Record<string, string> = {
  Live: "text-forest font-medium",
  "Waiting for approval": "text-coral-deep",
};

export default async function OwnerAds() {
  const a = await adStats();
  const live = a.placements.filter((p) => p.status === "Live").length;
  const waiting = a.placements.filter(
    (p) => p.status === "Waiting for approval",
  ).length;
  const views30 = a.placements.reduce((n, p) => n + p.last30.views, 0);
  const clicks30 = a.placements.reduce((n, p) => n + p.last30.clicks, 0);
  const pref = a.preferences;
  const audience =
    (pref.GENERIC ?? 0) + (pref.PROFILE_INTERESTS ?? 0) + (pref.NONE ?? 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
          Ads
        </h1>
        <Link href="/mod/sponsors" className="text-sm text-forest underline">
          Add, edit or approve sponsors
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink/70">
        Views and clicks are counted per day with no record of who saw what.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live sponsors" value={live} />
        <Stat
          label="Waiting for approval"
          value={waiting}
          href="/mod/sponsors"
          urgent={waiting > 0}
        />
        <Stat label="Views, last 30 days" value={views30} />
        <Stat
          label="Clicks, last 30 days"
          value={clicks30}
          hint={`${pct(clicks30, views30)} click rate`}
        />
      </div>

      <SectionTitle>Views per day, last 14 days</SectionTitle>
      <Bars
        rows={a.daily.map((d) => ({
          label: shortDay(d.day),
          value: d.views,
          note: `· ${d.clicks} clicks`,
        }))}
      />

      <SectionTitle>Who sees which ads</SectionTitle>
      <p className="mt-1 text-sm text-ink/70">
        Members choose this in Settings. Supporters can hide sponsors on the
        website only.
      </p>
      <Bars
        rows={[
          {
            label: "General",
            value: pref.GENERIC ?? 0,
            note: pct(pref.GENERIC ?? 0, audience),
          },
          {
            label: "Interests",
            value: pref.PROFILE_INTERESTS ?? 0,
            note: pct(pref.PROFILE_INTERESTS ?? 0, audience),
          },
          {
            label: "Hidden",
            value: pref.NONE ?? 0,
            note: pct(pref.NONE ?? 0, audience),
          },
        ]}
      />

      <SectionTitle>Sponsors</SectionTitle>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-forest/15 text-ink/70">
            <tr>
              <th className="py-2 pr-4 font-medium">Sponsor</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Runs</th>
              <th className="py-2 pr-4 text-right font-medium">Views (30 d)</th>
              <th className="py-2 pr-4 text-right font-medium">
                Clicks (30 d)
              </th>
              <th className="py-2 pr-4 text-right font-medium">Views (all)</th>
              <th className="py-2 pr-4 text-right font-medium">Clicks (all)</th>
              <th className="py-2 font-medium">Billing notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest/10">
            {a.placements.map((p) => (
              <tr key={p.id} className="align-top">
                <td className="py-2 pr-4">
                  <span className="font-medium">{p.sponsorName}</span>
                  <span className="block text-xs text-ink/60">{p.title}</span>
                </td>
                <td
                  className={`py-2 pr-4 ${STATUS_CLS[p.status] ?? "text-ink/70"}`}
                >
                  {p.status}
                </td>
                <td className="py-2 pr-4 text-xs text-ink/70">
                  {shortDay(p.startsAt)} –{" "}
                  {p.endsAt ? shortDay(p.endsAt) : "open"}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {p.last30.views.toLocaleString()}
                  {p.last30.appViews > 0 && (
                    <span className="block text-xs text-ink/60">
                      {p.last30.appViews.toLocaleString()} in apps
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {p.last30.clicks.toLocaleString()}
                  <span className="block text-xs text-ink/60">
                    {pct(p.last30.clicks, p.last30.views)}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {p.allTime.views.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {p.allTime.clicks.toLocaleString()}
                </td>
                <td className="max-w-xs whitespace-pre-wrap py-2 text-xs text-ink/70">
                  {p.staffNotes ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {a.placements.length === 0 && (
          <p className="mt-3 text-sm text-ink/70">
            No sponsors yet.{" "}
            <Link href="/mod/sponsors" className="underline">
              Add the first one
            </Link>
            .
          </p>
        )}
      </div>
      <p className="mt-4 text-xs text-ink/60">
        Send each sponsor their own numbers from this table when you bill them.
      </p>
    </div>
  );
}
