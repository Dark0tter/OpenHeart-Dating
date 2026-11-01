import Link from "next/link";
import { AuthTokenKind } from "@prisma/client";
import { AuthShell } from "@/components/auth-shell";
import { prisma } from "@/lib/prisma";
import { consumeAuthToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const userId = token
    ? await consumeAuthToken(token, AuthTokenKind.EMAIL_VERIFY)
    : null;
  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
  }

  return (
    <AuthShell>
      {userId ? (
        <div role="status" className="mt-8 space-y-4">
          <p className="rounded-md bg-mist px-3 py-3 text-sm text-forest">
            Your email is confirmed. Thank you!
          </p>
          <Link href="/feed" className="text-forest underline">
            Continue to OpenHeart
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <p className="rounded-md bg-coral/10 px-3 py-3 text-sm text-coral-deep">
            This confirmation link has expired or was already used.
          </p>
          <p className="text-sm text-ink/70">
            Log in and use the &ldquo;Send it again&rdquo; button at the top of
            the page to get a fresh link.
          </p>
          <Link href="/login" className="text-forest underline">
            Log in
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
