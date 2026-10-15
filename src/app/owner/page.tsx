import { Bars, pct, SectionTitle, shortDay, Stat } from "@/components/owner-ui";
import { growthStats, queueStats, serviceChecklist } from "@/lib/owner-stats";

export const dynamic = "force-dynamic";

export default async function OwnerOverview() {
  const [g, q] = await Promise.all([growthStats(), queueStats()]);
  const services = serviceChecklist();
  const f = g.funnel;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Overview
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        Only you can see this page. Figures are counts; no member is identified.
      </p>

      <SectionTitle>Members</SectionTitle>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live members" value={f.live} hint="Verified, profile on" />
        <Stat label="Active today" value={g.active1} />
        <Stat label="Active this week" value={g.active7} />
        <Stat label="Active this month" value={g.active30} />
        <Stat label="New this week" value={g.new7} />
        <Stat label="New this month" value={g.new30} />
        <Stat label="Supporters" value={g.supporters} />
        <Stat
          label="Suspended"
          value={g.suspended}
          hint={`${g.bans.toLocaleString()} permanent ban records`}
        />
      </div>

      <SectionTitle>Sign-up funnel</SectionTitle>
      <p className="mt-1 text-sm text-ink/70">
        Where people stop between signing up and going live.
      </p>
      <Bars
        rows={[
          { label: "Signed up", value: f.accounts },
          {
            label: "Email",
            value: f.emailConfirmed,
            note: pct(f.emailConfirmed, f.accounts),
          },
          {
            label: "Age verified",
            value: f.ageVerified,
            note: pct(f.ageVerified, f.accounts),
          },
          { label: "Live", value: f.live, note: pct(f.live, f.accounts) },
        ]}
      />

      <SectionTitle>Sign-ups, last 30 days</SectionTitle>
      <Bars
        rows={g.signupsByDay.map((d) => ({
          label: shortDay(d.day),
          value: d.count,
        }))}
      />

      <SectionTitle>Moderation queue</SectionTitle>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Urgent reports"
          value={q.urgent}
          href="/mod/reports?priority=HIGH"
          urgent={q.urgent > 0}
        />
        <Stat
          label="Child-safety cases not filed"
          value={q.childSafety}
          href="/mod/reports?escalated=1"
          urgent={q.childSafety > 0}
        />
        <Stat label="Open reports" value={q.open} href="/mod/reports" />
        <Stat label="Photos to review" value={q.photos} href="/mod/photos" />
        <Stat label="Selfies to review" value={q.selfies} href="/mod/selfies" />
        <Stat label="Appeals" value={q.appeals} href="/mod/appeals" />
        <Stat label="Support tickets" value={q.tickets} href="/mod/support" />
      </div>

      <SectionTitle>Services</SectionTitle>
      <ul className="mt-3 divide-y divide-forest/10 rounded-lg border border-forest/10">
        {services.map((s) => (
          <li key={s.name} className="flex items-start gap-3 px-4 py-2 text-sm">
            <span
              aria-label={s.ok ? "On" : "Off"}
              className={s.ok ? "text-forest" : "text-coral-deep"}
            >
              {s.ok ? "✓" : "✗"}
            </span>
            <span className="font-medium">{s.name}</span>
            {s.detail && <span className="text-ink/60">{s.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
