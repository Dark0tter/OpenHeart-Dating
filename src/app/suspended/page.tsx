import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountStatus } from "@prisma/client";
import { AuthShell } from "@/components/auth-shell";
import {
  AppealForm,
  SuspendedAccountActions,
} from "@/components/suspended-actions";
import { prisma } from "@/lib/prisma";
import { currentAccount } from "@/lib/session";

export const metadata = { title: "Account suspended · OpenHeart" };

export default async function SuspendedPage() {
  const user = await currentAccount();
  if (!user) redirect("/login");
  if (user.accountStatus !== AccountStatus.SUSPENDED) redirect("/feed");

  const appeals = await prisma.appeal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const pending = appeals.find((a) => a.status === "PENDING");
  const lastDecision = appeals.find((a) => a.status !== "PENDING");

  return (
    <AuthShell>
      <h1 className="mt-6 font-[family-name:var(--font-fraunces)] text-2xl text-forest">
        Your account is suspended
      </h1>
      <div className="mt-4 space-y-4 text-sm text-ink/75">
        <p>
          {user.suspendedUntil
            ? `It will be restored automatically on ${user.suspendedUntil.toUTCString()}.`
            : "It stays suspended until our safety team reviews it."}
        </p>
        {user.statusReason && (
          <p className="rounded-md bg-mist px-3 py-2 text-forest">
            Reason: {user.statusReason}
          </p>
        )}

        {pending ? (
          <p role="status" className="rounded-md bg-mist px-3 py-2 text-forest">
            Your appeal from {pending.createdAt.toUTCString()} is waiting for
            review. A moderator who wasn&apos;t involved in the original
            decision will look at it, usually within a few days.
          </p>
        ) : (
          <>
            {lastDecision && (
              <p className="rounded-md bg-mist px-3 py-2 text-forest">
                Your last appeal was{" "}
                {lastDecision.status === "APPROVED"
                  ? "approved"
                  : "not approved"}
                {lastDecision.reviewNote ? `: ${lastDecision.reviewNote}` : "."}
              </p>
            )}
            <AppealForm />
          </>
        )}

        <p>
          Questions about your data or account? Contact{" "}
          <Link href="/support" className="text-forest underline">
            support
          </Link>
          .
        </p>
        <SuspendedAccountActions />
      </div>
    </AuthShell>
  );
}
