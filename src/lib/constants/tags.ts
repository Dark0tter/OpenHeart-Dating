/** Preset taxonomies — discovery uses tags, never binary gender columns. */

export const IDENTITY_TAGS = [
  "Man",
  "Woman",
  "Trans Man",
  "Trans Woman",
  "Nonbinary",
  "Agender",
  "Bigender",
  "Genderfluid",
  "Genderqueer",
  "Intersex",
  "Two-Spirit",
  "Demiboy",
  "Demigirl",
  "Questioning",
] as const;

export const ORIENTATION_TAGS = [
  "Straight",
  "Gay",
  "Lesbian",
  "Bisexual",
  "Pansexual",
  "Asexual",
  "Demisexual",
  "Queer",
  "Polysexual",
  "Omnisexual",
  "Questioning",
] as const;

export const GOAL_TAGS = [
  "Marriage",
  "Long-Term",
  "Dating",
  "Friends",
  "Play Partners",
  "Poly Relationship",
  "Open Relationship",
  "Casual",
  "Networking",
  "Community",
] as const;

export const BODY_TAGS = [
  "Slim",
  "Average",
  "Athletic",
  "Muscular",
  "Curvy",
  "Plus Size",
  "Stocky",
] as const;

export const ETHNICITY_TAGS = [
  "Black",
  "White",
  "Latino",
  "Asian",
  "Middle Eastern",
  "Native American",
  "Pacific Islander",
  "Mixed",
  "Other",
] as const;

export const ACCESSIBILITY_TAGS = [
  "Wheelchair User",
  "Blind",
  "Low Vision",
  "Deaf",
  "Hard of Hearing",
  "Neurodivergent",
  "Chronic Illness",
] as const;

export const KINK_CATEGORIES: Record<string, string[]> = {
  BDSM: [
    "Dominant",
    "Submissive",
    "Switch",
    "Master",
    "Slave",
    "Daddy",
    "Mommy",
    "Rigger",
    "Rope Bunny",
    "Sadist",
    "Masochist",
  ],
  Roleplay: [
    "Teacher",
    "Student",
    "Fantasy",
    "Sci-Fi",
    "Historical",
    "Cosplay",
  ],
  Fetishes: [
    "Feet",
    "Latex",
    "Leather",
    "Uniforms",
    "Body Worship",
    "Sensory Play",
  ],
  "Power Exchange": [
    "24/7 Dynamics",
    "Owner Property",
    "Service Dynamic",
    "Caretaker",
  ],
};

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
