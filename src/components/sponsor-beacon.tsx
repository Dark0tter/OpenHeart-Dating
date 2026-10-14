"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { sponsorAllowedOn } from "@/lib/sponsor-pages";

const counted = new Set<string>();

/**
 * Counts one anonymous view the first time the block is actually on screen.
 * The layout keeps the block mounted across page changes, so each server
 * render is counted at most once.
 */
export function SponsorBeacon({
  placementId,
  renderId,
}: {
  placementId: string;
  renderId: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();
  const allowed = sponsorAllowedOn(pathname);

  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!allowed || !el || counted.has(renderId)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || counted.has(renderId)) {
          return;
        }
        counted.add(renderId);
        observer.disconnect();
        fetch(`/api/sponsors/${placementId}/view`, {
          method: "POST",
          keepalive: true,
        }).catch(() => {});
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [allowed, placementId, renderId]);

  return <span ref={ref} hidden />;
}
