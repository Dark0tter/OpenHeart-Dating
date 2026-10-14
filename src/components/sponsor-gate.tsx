"use client";

import { usePathname } from "next/navigation";
import { sponsorAllowedOn } from "@/lib/sponsor-pages";

export function SponsorGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return sponsorAllowedOn(pathname) ? children : null;
}
