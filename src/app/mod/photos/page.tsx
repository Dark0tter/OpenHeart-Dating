import { prisma } from "@/lib/prisma";
import { photoSrc, VISIBILITY_LABELS } from "@/lib/photos";
import { photoAction } from "@/app/mod/actions";

export const dynamic = "force-dynamic";

const btn =
  "rounded-md border border-forest/20 px-3 py-1.5 text-sm hover:bg-mist";

export default async function PhotoQueue() {
  const photos = await prisma.photo.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 60,
    include: { profile: { select: { displayName: true, userId: true } } },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Photos to review
      </h1>
      <p className="mt-1 text-sm text-ink/60">
        Approve photos that follow the photo rules. Remove anything else; tick
        &ldquo;block forever&rdquo; for serious violations so the same file can
        never be uploaded again. If a photo may show a minor, don&apos;t approve
        or remove it — open a report on the member and escalate.
      </p>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <li key={p.id} className="rounded-lg border border-forest/10 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc(p.id, "full")}
              alt=""
              className="aspect-square w-full rounded object-contain bg-ink/5"
            />
            <p className="mt-2 text-sm">
              {p.profile.displayName} · {VISIBILITY_LABELS[p.visibility]}
            </p>
            <form action={photoAction} className="mt-2 space-y-2">
              <input type="hidden" name="photoId" value={p.id} />
              <input
                name="reason"
                placeholder="Reason if removing"
                className="h-9 w-full rounded-md border border-forest/15 bg-cream/80 px-2 text-sm"
              />
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="blockForever" /> Block forever
              </label>
              <div className="flex gap-2">
                <button name="decision" value="approve" className={btn}>
                  Approve
                </button>
                <button
                  name="decision"
                  value="reject"
                  className={`${btn} text-coral-deep`}
                >
                  Remove
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
      {photos.length === 0 && (
        <p className="mt-6 text-ink/60">All caught up.</p>
      )}
    </div>
  );
}
