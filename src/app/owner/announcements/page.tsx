import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/owner-ui";
import {
  createAnnouncementAction,
  endAnnouncementAction,
} from "@/app/owner/actions";

export const dynamic = "force-dynamic";

const DURATIONS = [
  { hours: 1, label: "1 hour" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
  { hours: 336, label: "2 weeks" },
  { hours: 720, label: "30 days" },
  { hours: 0, label: "Until I take it down" },
];

const field = "h-9 rounded-md border border-forest/15 bg-cream/80 px-3 text-sm";

const when = (d: Date) =>
  d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

export default async function OwnerAnnouncements({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const now = new Date();
  const items = await prisma.announcement.findMany({
    orderBy: { startsAt: "desc" },
    take: 30,
  });
  const active = items.filter((a) => !a.endsAt || a.endsAt > now);
  const past = items.filter((a) => a.endsAt && a.endsAt <= now);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Announcements
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-ink/70">
        A short banner at the top of every page for signed-in members, for
        things like planned maintenance, a new city opening, or a community
        event. Members can dismiss it. Up to three show at once.
      </p>
      {ok && (
        <p
          role="status"
          className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          {ok}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-deep"
        >
          {error}
        </p>
      )}

      <SectionTitle>New announcement</SectionTitle>
      <form
        action={createAnnouncementAction}
        className="mt-3 max-w-2xl space-y-3 text-sm"
      >
        <label className="block">
          <span className="text-ink/80">Message (up to 280 characters)</span>
          <textarea
            name="message"
            required
            minLength={3}
            maxLength={280}
            rows={2}
            className="mt-1 w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-ink/80">Link (optional)</span>
            <input
              name="linkUrl"
              maxLength={300}
              placeholder="/events or https://…"
              className={`${field} mt-1 w-full`}
            />
          </label>
          <label className="block">
            <span className="text-ink/80">Link text</span>
            <input
              name="linkLabel"
              maxLength={40}
              placeholder="Learn more"
              className={`${field} mt-1 w-full`}
            />
          </label>
          <label className="block">
            <span className="text-ink/80">Style</span>
            <select
              name="tone"
              defaultValue="info"
              className={`${field} mt-1 w-full`}
            >
              <option value="info">Normal</option>
              <option value="warning">Important</option>
            </select>
          </label>
          <label className="block">
            <span className="text-ink/80">Show for</span>
            <select
              name="duration"
              defaultValue="168"
              className={`${field} mt-1 w-full`}
            >
              {DURATIONS.map((d) => (
                <option key={d.hours} value={d.hours}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="websiteOnly" className="mt-1" />
          <span>
            Website only. Tick this for anything about donations, supporters, or
            adult content, which must never appear in the phone apps.
          </span>
        </label>
        <button className="rounded-md bg-forest px-4 py-2 text-cream hover:bg-forest/90">
          Publish
        </button>
      </form>

      <SectionTitle>Showing now</SectionTitle>
      <ul className="mt-3 space-y-2 text-sm">
        {active.length === 0 && (
          <li className="text-ink/70">Nothing right now.</li>
        )}
        {active.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-forest/10 bg-cream/60 p-3"
          >
            <div>
              <p className={a.tone === "warning" ? "text-coral-deep" : ""}>
                {a.message}
              </p>
              <p className="mt-1 text-xs text-ink/60">
                Since {when(a.startsAt)}
                {a.endsAt ? ` · until ${when(a.endsAt)}` : ""}
                {a.websiteOnly ? " · website only" : " · website and apps"}
                {a.linkUrl ? ` · links to ${a.linkUrl}` : ""}
              </p>
            </div>
            <form action={endAnnouncementAction}>
              <input type="hidden" name="id" value={a.id} />
              <button className="rounded-md border border-coral/40 px-2.5 py-1 text-xs text-coral-deep hover:bg-coral/10">
                Take down
              </button>
            </form>
          </li>
        ))}
      </ul>

      {past.length > 0 && (
        <>
          <SectionTitle>Past</SectionTitle>
          <ul className="mt-3 space-y-1 text-sm text-ink/70">
            {past.map((a) => (
              <li key={a.id}>
                {when(a.startsAt)}: {a.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
