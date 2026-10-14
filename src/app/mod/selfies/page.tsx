import { prisma } from "@/lib/prisma";
import { photoSrc } from "@/lib/photos";
import { selfieAction } from "@/app/mod/actions";

export const dynamic = "force-dynamic";

const btn =
  "rounded-md border border-forest/20 px-3 py-1.5 text-sm hover:bg-mist";

export default async function SelfieQueue() {
  const selfies = await prisma.selfieVerification.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 30,
    include: {
      user: {
        select: {
          profile: {
            select: {
              displayName: true,
              photos: {
                where: { visibility: "PUBLIC" },
                orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                take: 4,
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Selfies to review
      </h1>
      <p className="mt-1 text-sm text-ink/70">
        Approve when the selfie shows the requested pose and is clearly the same
        person as the profile photos. The selfie is deleted as soon as you
        decide.
      </p>
      <ul className="mt-6 space-y-8">
        {selfies.map((s) => (
          <li key={s.id} className="rounded-lg border border-forest/10 p-4">
            <p className="text-sm">
              {s.user.profile?.displayName ?? "(no profile)"} · requested pose:{" "}
              <strong>{s.gesture}</strong>
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {s.storageKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/mod/files?key=${encodeURIComponent(s.storageKey)}`}
                  alt="Selfie"
                  className="aspect-square w-full rounded border-2 border-forest object-cover"
                />
              )}
              {s.user.profile?.photos.map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={photoSrc(p.id, "thumb")}
                  alt="Profile photo"
                  className="aspect-square w-full rounded object-cover"
                />
              ))}
            </div>
            <form action={selfieAction} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="selfieId" value={s.id} />
              <input
                name="note"
                placeholder="Note to member if rejecting"
                className="h-9 min-w-56 flex-1 rounded-md border border-forest/15 bg-cream/80 px-2 text-sm"
              />
              <button name="decision" value="approve" className={btn}>
                Approve
              </button>
              <button
                name="decision"
                value="reject"
                className={`${btn} text-coral-deep`}
              >
                Reject
              </button>
            </form>
          </li>
        ))}
      </ul>
      {selfies.length === 0 && (
        <p className="mt-6 text-ink/70">All caught up.</p>
      )}
    </div>
  );
}
