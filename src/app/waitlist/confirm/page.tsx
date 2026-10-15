import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { confirmWaitlist, leaveWaitlist } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

async function confirm(fd: FormData) {
  "use server";
  const token = String(fd.get("token") ?? "");
  const ok = await confirmWaitlist(token);
  redirect(
    ok
      ? `/waitlist/confirm?done=1&token=${encodeURIComponent(token)}`
      : "/waitlist/confirm?missing=1",
  );
}

async function leave(fd: FormData) {
  "use server";
  await leaveWaitlist(String(fd.get("token") ?? ""));
  redirect("/waitlist/confirm?left=1");
}

const btn = "rounded-md px-5 py-2.5 text-sm font-medium transition-colors";

export default async function ConfirmWaitlist({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    done?: string;
    left?: string;
    missing?: string;
  }>;
}) {
  const { token, done, left, missing } = await searchParams;
  let body: React.ReactNode;
  if (left) {
    body = <p>You&apos;re off the list and we&apos;ve deleted your address.</p>;
  } else if (missing || !token) {
    body = (
      <p>
        That link has expired or was already used.{" "}
        <Link href="/waitlist" className="text-forest underline">
          Join the waiting list again
        </Link>
        .
      </p>
    );
  } else {
    body = (
      <>
        <p>
          {done
            ? "You're on the list. We'll send one email when your city is ready."
            : "Tap Confirm to join the waiting list."}
        </p>
        <div className="flex flex-wrap gap-3">
          {!done && (
            <form action={confirm}>
              <input type="hidden" name="token" value={token} />
              <button
                className={`${btn} bg-coral text-cream hover:bg-coral-deep`}
              >
                Confirm
              </button>
            </form>
          )}
          <form action={leave}>
            <input type="hidden" name="token" value={token} />
            <button className={`${btn} border border-forest/20 hover:bg-mist`}>
              Remove me from the list
            </button>
          </form>
        </div>
      </>
    );
  }
  return (
    <div className="oh-atmosphere min-h-screen">
      <SiteHeader />
      <main
        id="main"
        className="mx-auto max-w-xl space-y-6 px-6 pb-20 pt-6 text-ink/85"
      >
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-forest">
          Waiting list
        </h1>
        {body}
      </main>
    </div>
  );
}
