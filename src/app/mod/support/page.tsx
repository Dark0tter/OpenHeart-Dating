import { prisma } from "@/lib/prisma";
import { SUPPORT_CATEGORIES } from "@/lib/constants/support";
import { emailConfigured } from "@/lib/email";
import { ticketAction } from "@/app/mod/actions";

export const dynamic = "force-dynamic";

const URGENT = new Set(["child_safety", "safety", "law_enforcement"]);

export default async function SupportQueue() {
  const tickets = await prisma.supportTicket.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  tickets.sort(
    (a, b) => Number(URGENT.has(b.category)) - Number(URGENT.has(a.category)),
  );
  const label = (id: string) =>
    SUPPORT_CATEGORIES.find((c) => c.id === id)?.label ?? id;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Support tickets
      </h1>
      {!emailConfigured() && (
        <p className="mt-2 rounded bg-coral/10 px-3 py-2 text-sm text-coral-deep">
          Email isn&apos;t set up yet, so replies written here won&apos;t be
          sent.
        </p>
      )}
      <ul className="mt-6 space-y-6">
        {tickets.map((t) => (
          <li
            key={t.id}
            className={`rounded-lg border p-4 ${URGENT.has(t.category) ? "border-coral" : "border-forest/10"}`}
          >
            <p className="text-sm text-ink/70">
              {label(t.category)} · {t.email} · {t.createdAt.toUTCString()} · #
              {t.id.slice(0, 8)}
            </p>
            <p className="mt-1 font-medium">{t.subject}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{t.body}</p>
            <form action={ticketAction} className="mt-3 space-y-2">
              <input type="hidden" name="ticketId" value={t.id} />
              <textarea
                name="reply"
                rows={3}
                placeholder="Reply (emailed to them). Leave empty to close without replying."
                className="w-full rounded-md border border-forest/15 bg-cream/80 px-3 py-2 text-sm"
              />
              <button className="rounded-md border border-forest/20 px-3 py-1.5 text-sm hover:bg-mist">
                Send &amp; close
              </button>
            </form>
          </li>
        ))}
      </ul>
      {tickets.length === 0 && <p className="mt-6 text-ink/70">Inbox zero.</p>}
    </div>
  );
}
