/**
 * Preset taxonomies — discovery uses tags, never binary gender columns.
 *
 * Seeding upserts by slug (derived from the label, and for interests from
 * category + name). Adding entries is safe; renaming or moving one to another
 * interest category creates a new row and orphans the old one on profiles.
 */

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
  "Transgender",
  "Transfeminine",
  "Transmasculine",
  "Cis Man",
  "Cis Woman",
  "Androgyne",
  "Neutrois",
  "Pangender",
  "Xenogender",
  "Butch",
  "Femme",
  "Masc",
  "Gender Nonconforming",
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
  "Aromantic",
  "Graysexual",
  "Grayromantic",
  "Heteroflexible",
  "Homoflexible",
  "Sapiosexual",
  "Abrosexual",
  "Bicurious",
  "Same-Gender Loving",
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

export const RELATIONSHIP_STYLE_TAGS = [
  "Monogamous",
  "Monogamish",
  "Ethically Non-Monogamous",
  "Polyamorous",
  "Hierarchical Poly",
  "Non-Hierarchical Poly",
  "Solo Poly",
  "Kitchen-Table Poly",
  "Parallel Poly",
  "Polyfidelity",
  "Relationship Anarchy",
  "Open Relationship",
  "Swinger",
  "Exploring / Not Sure",
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

/** Shown on the category's room and in the profile interest picker. */
export const INTEREST_CATEGORY_NOTES: Record<string, string> = {
  "Lifestyle & Values":
    "Everyday priorities, values, and the kind of life members want to build.",
  "Activities & Hobbies":
    "Shared activities that make it easier to plan a first date or weekend together.",
  "Arts & Culture":
    "Music, books, shows, and creative interests that help conversations start naturally.",
  "Food & Nightlife":
    "Dining, drinks, and going-out preferences for planning low-pressure dates.",
  "Outdoors & Travel":
    "Outdoor time, local exploring, and travel styles.",
  "Wellness & Growth":
    "Health, self-improvement, and emotional compatibility interests.",
  "Home & Family":
    "Home life, pets, family goals, and day-to-day rhythms.",
  "Communication & Compatibility":
    "Conversation styles, boundaries, and relationship habits that support healthy dating.",
  "Causes & Community":
    "Community involvement, volunteering, and causes members care about.",
  "Date Ideas":
    "Specific date ideas members would enjoy trying with someone new.",
};

export const INTEREST_CATEGORIES: Record<string, string[]> = {
  "Lifestyle & Values": [
    "Kindness",
    "Honesty",
    "Emotional Availability",
    "Ambition",
    "Independence",
    "Stability",
    "Faith Friendly",
    "Spiritual but Not Religious",
    "Politics Matter",
    "Low-Drama Living",
    "Financial Responsibility",
    "Career Focused",
    "Work-Life Balance",
    "Creative Life",
    "Simple Living",
    "City Life",
    "Suburban Life",
    "Rural Life",
  ],
  "Activities & Hobbies": [
    "Fitness",
    "Running",
    "Cycling",
    "Yoga",
    "Dancing",
    "Board Games",
    "Video Games",
    "Trivia Nights",
    "Karaoke",
    "Photography",
    "Gardening",
    "DIY Projects",
    "Cooking",
    "Baking",
    "Sports Fan",
    "Watching Movies",
    "Podcasts",
    "Writing",
    "Crafting",
    "Learning New Skills",
  ],
  "Arts & Culture": [
    "Live Music",
    "Concerts",
    "Theater",
    "Museums",
    "Art Galleries",
    "Stand-Up Comedy",
    "Film Festivals",
    "Bookstores",
    "Book Clubs",
    "Poetry",
    "Indie Films",
    "Documentaries",
    "History",
    "Architecture",
    "Local Events",
  ],
  "Food & Nightlife": [
    "Coffee Dates",
    "Brunch",
    "Dinner Dates",
    "Trying New Restaurants",
    "Farmers Markets",
    "Food Trucks",
    "Wine Tasting",
    "Craft Beer",
    "Mocktails",
    "Cocktail Lounges",
    "Dive Bars",
    "Diners",
    "Vegetarian Food",
    "Vegan Food",
    "Dessert Spots",
    "Cooking Together",
  ],
  "Outdoors & Travel": [
    "Hiking",
    "Camping",
    "Beach Days",
    "Parks",
    "Road Trips",
    "Weekend Getaways",
    "International Travel",
    "National Parks",
    "Stargazing",
    "Kayaking",
    "Skiing",
    "Snowboarding",
    "Fishing",
    "Picnics",
    "Walking Around Town",
    "Local Exploring",
  ],
  "Wellness & Growth": [
    "Therapy Positive",
    "Mindfulness",
    "Meditation",
    "Mental Health Awareness",
    "Personal Growth",
    "Healthy Eating",
    "Sober Lifestyle",
    "Sober Curious",
    "Gym Routine",
    "Rest and Recharge",
    "Journaling",
    "Goal Setting",
    "Reading",
    "Self-Care",
  ],
  "Home & Family": [
    "Dog Lover",
    "Cat Lover",
    "Pet Parent",
    "Wants Kids",
    "Has Kids",
    "Open to Kids",
    "Doesn't Want Kids",
    "Close With Family",
    "Chosen Family",
    "Homebody",
    "Hosting Friends",
    "Clean and Organized",
    "Cozy Nights In",
    "Sunday Reset",
    "Plant Parent",
  ],
  "Communication & Compatibility": [
    "Direct Communication",
    "Gentle Communication",
    "Deep Conversations",
    "Playful Banter",
    "Consistent Texting",
    "Phone Calls",
    "Video Chats",
    "Quality Time",
    "Words of Affirmation",
    "Acts of Service",
    "Gift Giving",
    "Physical Affection",
    "Personal Space",
    "Slow Burn",
    "Intentional Dating",
    "Clear Boundaries",
  ],
  "Causes & Community": [
    "Volunteering",
    "Mutual Aid",
    "Animal Rescue",
    "Environmental Causes",
    "LGBTQIA+ Community",
    "Disability Advocacy",
    "Racial Justice",
    "Local Politics",
    "Faith Community",
    "Mentoring",
    "Community Events",
    "Supporting Small Business",
  ],
  "Date Ideas": [
    "Coffee Walk",
    "Museum Date",
    "Picnic Date",
    "Arcade Date",
    "Live Show",
    "Cooking Night",
    "Bookstore Date",
    "Farmers Market Date",
    "Mini Golf",
    "Bowling",
    "Escape Room",
    "Dessert Date",
    "Sunset Walk",
    "Game Night",
    "Workout Date",
    "Volunteer Date",
  ],
};

/** General dating interests are app-safe by default. */
export type ContentTierName = "STANDARD" | "ADULT_TEXT" | "WEB_ONLY";

export function categoryTier(category: string): ContentTierName {
  void category;
  return "STANDARD";
}

export function interestTier(category: string, name: string): ContentTierName {
  void category;
  void name;
  return "STANDARD";
}

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
