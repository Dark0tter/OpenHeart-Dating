import { AppNav } from "@/components/app-nav";
import { SponsorSlot } from "@/components/sponsor-slot";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="oh-atmosphere min-h-screen">
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="px-4 pb-10">
        <SponsorSlot />
      </footer>
    </div>
  );
}
