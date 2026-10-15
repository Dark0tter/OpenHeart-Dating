"use client";

import { usePathname } from "next/navigation";
import { EmptyState } from "@/components/empty-state";

/** Pages that show other members; only verified adults with a live profile see them. */
const MEMBER_PAGES = [
  "/feed",
  "/search",
  "/members",
  "/matches",
  "/likes",
  "/messages",
  "/events",
  "/rooms",
];

export function MemberGate({
  isMember,
  children,
}: {
  isMember: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const gated = MEMBER_PAGES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isMember || !gated) return children;
  return (
    <EmptyState
      title="Finish setting up to meet people"
      body="Everyone on Kindred Kinks is a verified adult. Verify your age and make your profile live, and you'll be able to browse, like, and message."
      actions={[{ href: "/onboarding", label: "Finish setting up" }]}
    />
  );
}
