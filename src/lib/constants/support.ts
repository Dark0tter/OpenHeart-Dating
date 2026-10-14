export const SUPPORT_CATEGORIES = [
  { id: "account", label: "Signing in or my account" },
  { id: "safety", label: "Safety concern about a member" },
  { id: "child_safety", label: "Child safety (urgent)" },
  { id: "privacy", label: "Privacy or data request" },
  { id: "bug", label: "Something isn't working" },
  { id: "billing", label: "Supporter membership" },
  { id: "law_enforcement", label: "Law enforcement request" },
  { id: "feedback", label: "Feedback or idea" },
  { id: "other", label: "Something else" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["id"];

export const SUPPORT_CATEGORY_IDS = SUPPORT_CATEGORIES.map((c) => c.id) as [
  SupportCategory,
  ...SupportCategory[],
];
