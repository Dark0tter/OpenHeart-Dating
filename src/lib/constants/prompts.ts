export const MAX_PROMPTS = 3;
export const MAX_PROMPT_ANSWER = 300;

export const PROFILE_PROMPTS = [
  { id: "perfect-first-meet", question: "My idea of a perfect first meet" },
  { id: "green-flags", question: "Green flags I look for" },
  { id: "consent-means", question: "To me, good consent looks like" },
  { id: "aftercare", question: "My favorite kind of aftercare" },
  { id: "geek-out", question: "I could talk for hours about" },
  { id: "community", question: "My favorite part of queer community" },
  { id: "comfort", question: "I feel most like myself when" },
  { id: "dealbreaker", question: "A dealbreaker for me is" },
  { id: "learning", question: "Something I'm curious to explore" },
  { id: "sunday", question: "A typical Sunday for me" },
  {
    id: "pronouns-tip",
    question: "Something I wish more people knew about my identity",
  },
  { id: "communicate", question: "How I like to communicate" },
  { id: "proud-of", question: "Something I'm proud of" },
  { id: "chosen-family", question: "My chosen family would describe me as" },
  { id: "boundaries", question: "A boundary I always keep" },
  { id: "ideal-date", question: "Let's skip the small talk and" },
  { id: "music", question: "The song that's always on my playlist" },
  {
    id: "accessibility",
    question: "Access needs that help me show up as myself",
  },
] as const;

export type PromptId = (typeof PROFILE_PROMPTS)[number]["id"];

const BY_ID = new Map<string, string>(
  PROFILE_PROMPTS.map((p) => [p.id, p.question]),
);

export function promptQuestion(id: string): string | null {
  return BY_ID.get(id) ?? null;
}
