import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount, isStaff } from "@/lib/session";
import { TwoStepManager } from "@/components/two-step-manager";

export const dynamic = "force-dynamic";

export default async function TwoStepPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string }>;
}) {
  const user = await currentAccount();
  if (!user) redirect("/login?next=/settings/two-step");
  const { staff } = await searchParams;
  const enabled = Boolean(user.totpEnabledAt);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/settings" className="text-sm text-forest underline">
        Back to settings
      </Link>
      <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-3xl text-forest">
        Two-step sign-in
      </h1>
      <p className="mt-2 text-sm text-ink/70">
        Signing in will need your password and a 6-digit code from an
        authenticator app on your phone (Google Authenticator, Microsoft
        Authenticator, 1Password, Authy, or similar). Someone who learns your
        password still can&apos;t get in.
      </p>
      {staff && !enabled && isStaff(user.role) && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-deep"
        >
          Staff tools show private reports, so they need two-step sign-in. Turn
          it on below, then sign in again.
        </p>
      )}
      <div className="mt-6">
        <TwoStepManager
          enabled={enabled}
          enabledOn={
            user.totpEnabledAt?.toLocaleDateString("en-US", {
              dateStyle: "medium",
            }) ?? null
          }
          codesLeft={user.recoveryCodes.length}
          staff={isStaff(user.role)}
        />
      </div>
    </div>
  );
}
