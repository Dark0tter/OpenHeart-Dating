import Link from "next/link";
import { Bars, SectionTitle } from "@/components/owner-ui";
import { cityStats, countryStats } from "@/lib/owner-stats";
import { waitlistDemand, waitlistThreshold } from "@/lib/waitlist";
import { emailWaitlist } from "@/app/owner/actions";

export const dynamic = "force-dynamic";

/** Rough points where local sponsors start paying (see the ads estimate). */
const SPONSOR_READY = 1000;
const SPONSOR_SOON = 300;

function readiness(active30: number) {
  if (active30 >= SPONSOR_READY) {
    return { text: "Ready for local sponsors", cls: "text-forest font-medium" };
  }
  if (active30 >= SPONSOR_SOON) {
    return { text: "Getting there", cls: "text-ink/70" };
  }
  return null;
}

export default async function OwnerCities({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; sent?: string }>;
}) {
  const { country, sent } = await searchParams;
  const [cities, countries, waiting] = await Promise.all([
    cityStats({ country }),
    countryStats(),
    waitlistDemand(),
  ]);
  const threshold = waitlistThreshold();

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Cities
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        Members by the city they put on their profile (spellings that differ
        only by capitals are merged). &ldquo;Active&rdquo; means they used the
        site in the last 30 days.
      </p>

      <SectionTitle>Countries</SectionTitle>
      <Bars
        rows={countries.map((c) => ({
          label: c.country ?? "Not set",
          value: c.members,
        }))}
      />

      <SectionTitle>
        {country ? `Cities in ${country}` : "Top cities"}
      </SectionTitle>
      <form className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="country" className="text-ink/70">
          Country
        </label>
        <input
          id="country"
          name="country"
          defaultValue={country ?? ""}
          placeholder="e.g. United States"
          className="h-9 rounded-md border border-forest/15 bg-cream/80 px-3"
        />
        <button className="h-9 rounded-md border border-forest/20 px-3 hover:bg-mist">
          Filter
        </button>
        {country && (
          <Link href="/owner/cities" className="text-forest underline">
            All countries
          </Link>
        )}
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-forest/15 text-ink/70">
            <tr>
              <th className="py-2 pr-4 font-medium">Place</th>
              <th className="py-2 pr-4 text-right font-medium">Members</th>
              <th className="py-2 pr-4 text-right font-medium">Live</th>
              <th className="py-2 pr-4 text-right font-medium">
                Active (30 days)
              </th>
              <th className="py-2 pr-4 text-right font-medium">
                New (30 days)
              </th>
              <th className="py-2 font-medium">Sponsors</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-forest/10">
            {cities.map((c) => {
              const place =
                [c.city, c.state, c.country].filter(Boolean).join(", ") ||
                "No location set";
              const r = readiness(c.active30);
              return (
                <tr key={place}>
                  <td className="py-2 pr-4">{place}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {c.members.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {c.live.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {c.active30.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {c.new30.toLocaleString()}
                  </td>
                  <td className={`py-2 ${r?.cls ?? ""}`}>{r?.text ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cities.length === 0 && (
          <p className="mt-3 text-sm text-ink/70">No members yet.</p>
        )}
      </div>
      <p className="mt-4 text-xs text-ink/60">
        &ldquo;Ready for local sponsors&rdquo; means{" "}
        {SPONSOR_READY.toLocaleString()}+ members active in the last 30 days —
        about where a local business will pay around $100 a month for the
        sponsor spot.
      </p>

      <div id="waitlist" className="scroll-mt-6">
        <SectionTitle>Waiting list</SectionTitle>
      </div>
      <p className="mt-1 text-sm text-ink/70">
        Confirmed people waiting for their city to fill up, from the{" "}
        <Link href="/waitlist" className="underline">
          waiting list page
        </Link>
        . Each city&apos;s list gets one email automatically once it has{" "}
        {threshold} live members (change with <code>WAITLIST_NOTIFY_AT</code>
        ), and their addresses are deleted right after. A long list here is a
        good sign of where to promote next.
      </p>
      {sent && (
        <p
          role="status"
          className="mt-3 rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {sent}
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-forest/15 text-ink/70">
            <tr>
              <th className="py-2 pr-4 font-medium">City</th>
              <th className="py-2 pr-4 text-right font-medium">Waiting</th>
              <th className="py-2 pr-4 text-right font-medium">
                Live members there
              </th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-forest/10">
            {waiting.map((w) => (
              <tr key={`${w.city}|${w.state ?? ""}`}>
                <td className="py-2 pr-4">
                  {[w.city, w.state, w.country].filter(Boolean).join(", ")}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {w.waiting}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">{w.live}</td>
                <td className="py-2">
                  <form action={emailWaitlist}>
                    <input type="hidden" name="city" value={w.city} />
                    <input type="hidden" name="state" value={w.state ?? ""} />
                    <button className="rounded-md border border-forest/20 px-2.5 py-1 text-xs hover:bg-mist">
                      Email them now
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {waiting.length === 0 && (
          <p className="mt-3 text-sm text-ink/70">Nobody waiting.</p>
        )}
      </div>
    </div>
  );
}
