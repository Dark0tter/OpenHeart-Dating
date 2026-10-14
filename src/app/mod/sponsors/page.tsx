import { notFound } from "next/navigation";
import { ContentTier, SponsorLabel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { APP_DAILY_CAP } from "@/lib/sponsors";
import { APPROVAL_CHECKS } from "@/lib/sponsor-review";
import {
  approveSponsor,
  saveSponsor,
  sponsorStatus,
} from "@/app/mod/sponsor-actions";

export const dynamic = "force-dynamic";

const LABELS: Record<SponsorLabel, string> = {
  SPONSOR_SPOTLIGHT: "Sponsor Spotlight",
  COMMUNITY_PARTNER: "Community Partner",
  COMMUNITY_EVENT: "Community Event",
  EDUCATIONAL_RESOURCE: "Educational Resource",
};

const btn =
  "rounded-md border border-forest/20 px-2.5 py-1 text-xs hover:bg-mist";
const input =
  "mt-1 h-10 w-full rounded-md border border-forest/15 bg-cream/80 px-3 text-sm";

const utcInput = (d: Date | null | undefined) =>
  d ? d.toISOString().slice(0, 16) : "";

type Placement = Awaited<
  ReturnType<typeof prisma.sponsorPlacement.findMany>
>[number];

function status(p: Placement, now: Date) {
  if (!p.approvedAt) return { text: "Waiting for approval", tone: "coral" };
  if (!p.isActive) return { text: "Paused", tone: "muted" };
  if (p.endsAt && p.endsAt <= now) return { text: "Ended", tone: "muted" };
  if (p.startsAt > now) return { text: "Scheduled", tone: "muted" };
  return {
    text:
      p.contentTier === ContentTier.STANDARD
        ? "Live on website and apps"
        : "Live on website only",
    tone: "forest",
  };
}

export default async function SponsorsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; error?: string; saved?: string }>;
}) {
  if (!(await requireStaff("ADMIN"))) notFound();
  const { edit, error, saved } = await searchParams;
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [placements, stats] = await Promise.all([
    prisma.sponsorPlacement.findMany({
      orderBy: [
        { approvedAt: { sort: "asc", nulls: "first" } },
        { createdAt: "desc" },
      ],
    }),
    prisma.sponsorDailyStat.findMany({
      where: { day: { gte: since } },
      orderBy: { day: "desc" },
    }),
  ]);
  const editing = placements.find((p) => p.id === edit);

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Sponsors
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-ink/70">
        Sponsors are sold directly — there are no ad networks or trackers. A
        listing shows only after an admin approves it. Listings approved for
        &ldquo;website and apps&rdquo; must be suitable for everyone; the apps
        never show anything else, show each listing at most {APP_DAILY_CAP}{" "}
        times a day per person, and never show sponsors in messages, room chats,
        signup, safety pages, settings, or on other people&apos;s profiles.
        Totals below are anonymous daily counts — we never record who saw or
        clicked.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-coral/15 px-3 py-2 text-sm text-coral-deep"
        >
          {error}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className="mt-4 rounded-md bg-mist px-3 py-2 text-sm text-forest"
        >
          Saved. It needs approval before it shows.
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {placements.map((p) => {
          const s = status(p, now);
          const rows = stats.filter((r) => r.placementId === p.id);
          const views = rows.reduce((n, r) => n + r.views, 0);
          const appViews = rows.reduce((n, r) => n + r.appViews, 0);
          const clicks = rows.reduce((n, r) => n + r.clicks, 0);
          return (
            <li key={p.id} className="rounded-lg border border-forest/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-forest">
                    {p.sponsorName} — {p.title}
                  </p>
                  <p className="text-xs text-ink/70">
                    {LABELS[p.label]} · up to {p.dailyCap}× per person per day ·
                    from {utcInput(p.startsAt).replace("T", " ")} UTC
                    {p.endsAt &&
                      ` to ${utcInput(p.endsAt).replace("T", " ")} UTC`}
                  </p>
                  {(p.targetKinkSlugs.length > 0 ||
                    p.targetGoalSlugs.length > 0) && (
                    <p className="text-xs text-ink/70">
                      Shown to people who list:{" "}
                      {[...p.targetKinkSlugs, ...p.targetGoalSlugs].join(", ")}
                    </p>
                  )}
                </div>
                <span
                  className={
                    s.tone === "forest"
                      ? "rounded-full bg-forest px-2.5 py-1 text-xs text-cream"
                      : s.tone === "coral"
                        ? "rounded-full bg-coral/20 px-2.5 py-1 text-xs text-coral-deep"
                        : "rounded-full bg-mist px-2.5 py-1 text-xs text-forest"
                  }
                >
                  {s.text}
                </span>
              </div>

              <div className="mt-3 max-w-[300px] rounded-md border border-forest/15 bg-cream/70 p-3 text-sm">
                <p className="text-[11px] font-medium uppercase tracking-wide text-sage">
                  {LABELS[p.label]} · {p.sponsorName}
                </p>
                <p className="mt-1 font-medium text-ink">{p.title}</p>
                {p.body && <p className="mt-1 text-ink/70">{p.body}</p>}
                <p className="mt-2 truncate text-xs text-coral">{p.linkUrl}</p>
              </div>

              <p className="mt-3 text-sm text-ink/85">
                Last 30 days: <strong>{views}</strong> views ({appViews} in the
                apps) · <strong>{clicks}</strong> clicks
                {views > 0 &&
                  ` · ${((clicks / views) * 100).toFixed(1)}% click rate`}
              </p>
              {rows.length > 0 && (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-forest">
                    Daily totals (for the sponsor&apos;s report)
                  </summary>
                  <table className="mt-2 text-left text-xs">
                    <thead className="text-ink/70">
                      <tr>
                        <th className="pr-4">Day (UTC)</th>
                        <th className="pr-4">Views</th>
                        <th className="pr-4">In apps</th>
                        <th>Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.day.toISOString()}>
                          <td className="pr-4">
                            {r.day.toISOString().slice(0, 10)}
                          </td>
                          <td className="pr-4">{r.views}</td>
                          <td className="pr-4">{r.appViews}</td>
                          <td>{r.clicks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
              {p.staffNotes && (
                <p className="mt-2 whitespace-pre-wrap text-xs text-ink/70">
                  Notes: {p.staffNotes}
                </p>
              )}

              {!p.approvedAt && (
                <form
                  action={approveSponsor}
                  className="mt-4 space-y-2 rounded-md bg-mist/60 p-3 text-sm"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <p className="font-medium text-forest">
                    Approve this listing
                  </p>
                  {APPROVAL_CHECKS.map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input type="checkbox" name={key} required />
                      {label}
                    </label>
                  ))}
                  <fieldset className="flex flex-wrap gap-4 pt-1">
                    <legend className="sr-only">Where it can show</legend>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="where"
                        value="website"
                        defaultChecked
                      />
                      Website only
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="where" value="everywhere" />
                      Website and apps (suitable for everyone)
                    </label>
                  </fieldset>
                  <button className="rounded-md bg-forest px-3 py-1.5 text-sm text-cream">
                    Approve
                  </button>
                </form>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/mod/sponsors?edit=${p.id}#form`} className={btn}>
                  Edit
                </a>
                <form action={sponsorStatus}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    name="action"
                    value={p.isActive ? "pause" : "resume"}
                    className={btn}
                  >
                    {p.isActive ? "Pause" : "Resume"}
                  </button>
                </form>
                <details>
                  <summary className={`${btn} cursor-pointer list-none`}>
                    Delete…
                  </summary>
                  <form action={sponsorStatus} className="mt-2">
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      name="action"
                      value="delete"
                      className="rounded-md bg-coral-deep px-2.5 py-1 text-xs text-cream"
                    >
                      Delete for good (and its totals)
                    </button>
                  </form>
                </details>
              </div>
            </li>
          );
        })}
      </ul>
      {placements.length === 0 && (
        <p className="mt-6 text-ink/70">
          No sponsors yet. Add the first one below.
        </p>
      )}

      <form
        id="form"
        action={saveSponsor}
        className="mt-10 max-w-2xl scroll-mt-20 space-y-4 rounded-lg border border-forest/15 p-5"
      >
        <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-forest">
          {editing ? `Edit ${editing.sponsorName}` : "Add a sponsor"}
        </h2>
        {editing && (
          <>
            <input type="hidden" name="id" value={editing.id} />
            <p className="text-sm text-ink/70">
              Saving changes takes it offline until it&apos;s approved again.{" "}
              <a href="/mod/sponsors#form" className="underline">
                Cancel
              </a>
            </p>
          </>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Sponsor name
            <input
              name="sponsorName"
              required
              maxLength={80}
              defaultValue={editing?.sponsorName}
              className={input}
            />
          </label>
          <label className="text-sm">
            Label
            <select
              name="label"
              defaultValue={editing?.label ?? "SPONSOR_SPOTLIGHT"}
              className={input}
            >
              {Object.entries(LABELS).map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          Title
          <input
            name="title"
            required
            maxLength={80}
            defaultValue={editing?.title}
            className={input}
          />
        </label>
        <label className="block text-sm">
          Description (optional, up to 240 characters)
          <textarea
            name="body"
            maxLength={240}
            rows={3}
            defaultValue={editing?.body ?? ""}
            className="mt-1 w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          Link (https)
          <input
            name="linkUrl"
            type="url"
            required
            pattern="https://.*"
            defaultValue={editing?.linkUrl}
            className={input}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            Starts (UTC)
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={utcInput(editing?.startsAt)}
              className={input}
            />
          </label>
          <label className="text-sm">
            Ends (UTC, optional)
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={utcInput(editing?.endsAt)}
              className={input}
            />
          </label>
          <label className="text-sm">
            Max per person per day
            <input
              name="dailyCap"
              type="number"
              min={1}
              max={10}
              defaultValue={editing?.dailyCap ?? 3}
              className={input}
            />
          </label>
        </div>
        <label className="block text-sm">
          Only show to people who list these interests (optional,
          comma-separated slugs)
          <input
            name="targetKinkSlugs"
            defaultValue={editing?.targetKinkSlugs.join(", ")}
            className={input}
          />
        </label>
        <label className="block text-sm">
          …or these relationship goals (optional, comma-separated slugs)
          <input
            name="targetGoalSlugs"
            defaultValue={editing?.targetGoalSlugs.join(", ")}
            className={input}
          />
        </label>
        <p className="text-xs text-ink/70">
          Targeted listings only reach members who opted in to interest-based
          sponsors, and never anyone who marked that interest as a limit.
        </p>
        <label className="block text-sm">
          Staff notes (contact, price paid, invoice — never shown to members)
          <textarea
            name="staffNotes"
            rows={2}
            maxLength={2000}
            defaultValue={editing?.staffNotes ?? ""}
            className="mt-1 w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
          />
        </label>
        <button className="rounded-md bg-forest px-4 py-2 text-sm text-cream">
          {editing ? "Save changes" : "Add sponsor"}
        </button>
      </form>
    </div>
  );
}
