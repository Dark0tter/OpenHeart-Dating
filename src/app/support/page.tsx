import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SupportForm } from "@/components/support-form";
import { currentAccount } from "@/lib/session";
import { isAppRequest } from "@/lib/content-policy";

export const metadata: Metadata = { title: "Support — Kindred Kinks" };

export default async function SupportPage() {
  const user = await currentAccount();
  return (
    <div className="oh-atmosphere min-h-screen">
      <SiteHeader />
      <main
        id="main"
        className="mx-auto max-w-xl space-y-6 px-6 pb-20 pt-6 text-ink/85"
      >
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-forest">
          Contact support
        </h1>
        <p>
          A real person reads every message. To report a specific member, use
          the Report button on their profile or in your chat — it sends us the
          context we need.
        </p>
        <p className="rounded-md bg-coral/10 px-3 py-2 text-sm text-coral-deep">
          If someone is in immediate danger, contact local emergency services
          first. In the US you can also call or text 988 for crisis support.
        </p>
        <SupportForm
          defaultEmail={user?.email ?? ""}
          inApp={await isAppRequest()}
        />
      </main>
    </div>
  );
}
