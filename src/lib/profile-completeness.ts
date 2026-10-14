export type CompletenessInput = {
  publicPhotos: number;
  bio: string | null;
  pronouns: string | null;
  identityCount: number;
  orientationCount: number;
  goalCount: number;
  promptCount: number;
  hasLocation: boolean;
  emailVerified: boolean;
  ageVerified: boolean;
  photoVerified: boolean;
};

export type CompletenessStep = { key: string; label: string; done: boolean };

const STEPS: {
  key: string;
  label: string;
  weight: number;
  done: (i: CompletenessInput) => boolean;
}[] = [
  {
    key: "photo",
    label: "Add a public photo",
    weight: 20,
    done: (i) => i.publicPhotos >= 1,
  },
  {
    key: "photos3",
    label: "Add at least 3 photos",
    weight: 5,
    done: (i) => i.publicPhotos >= 3,
  },
  {
    key: "bio",
    label: "Write a bio of a few sentences",
    weight: 15,
    done: (i) => (i.bio?.trim().length ?? 0) >= 60,
  },
  {
    key: "identity",
    label: "Choose your identity",
    weight: 10,
    done: (i) => i.identityCount > 0,
  },
  {
    key: "orientation",
    label: "Choose your orientation",
    weight: 5,
    done: (i) => i.orientationCount > 0,
  },
  {
    key: "goals",
    label: "Say what you're looking for",
    weight: 10,
    done: (i) => i.goalCount > 0,
  },
  {
    key: "prompts",
    label: "Answer a profile question",
    weight: 10,
    done: (i) => i.promptCount > 0,
  },
  {
    key: "pronouns",
    label: "Add your pronouns",
    weight: 5,
    done: (i) => Boolean(i.pronouns?.trim()),
  },
  {
    key: "location",
    label: "Set your location",
    weight: 5,
    done: (i) => i.hasLocation,
  },
  {
    key: "email",
    label: "Confirm your email",
    weight: 5,
    done: (i) => i.emailVerified,
  },
  {
    key: "age",
    label: "Verify your age",
    weight: 5,
    done: (i) => i.ageVerified,
  },
  {
    key: "selfie",
    label: "Get the photo-verified badge",
    weight: 5,
    done: (i) => i.photoVerified,
  },
];

export function profileCompleteness(input: CompletenessInput): {
  percent: number;
  steps: CompletenessStep[];
} {
  const total = STEPS.reduce((n, s) => n + s.weight, 0);
  let earned = 0;
  const steps = STEPS.map((s) => {
    const done = s.done(input);
    if (done) earned += s.weight;
    return { key: s.key, label: s.label, done };
  });
  return { percent: Math.round((earned / total) * 100), steps };
}
