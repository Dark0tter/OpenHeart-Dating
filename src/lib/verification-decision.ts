export type VerificationOutcome =
  "VERIFIED_ADULT" | "NOT_VERIFIED" | "REJECTED";

/** A final result from any age-verification provider, in our terms. */
export type ProviderDecision = {
  /** Our reference, sent to the provider when the check started. */
  reference: string;
  /** The provider's id for the check, used to delete its copy of the data. */
  sessionId: string;
  outcome: VerificationOutcome;
  underage?: boolean;
  identity: {
    first: string | null;
    last: string | null;
    birthdate: string | null;
  };
};

/** Whole years between a YYYY-MM-DD birthdate and now. */
export function ageFromBirthdate(
  birthdate: string,
  now = new Date(),
): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthdate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getUTCFullYear() - y;
  const beforeBirthday =
    now.getUTCMonth() + 1 < mo ||
    (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

/**
 * An approved check is only an adult verification if the document doesn't
 * say otherwise; a provider approving a 17-year-old's real ID is underage.
 */
export function decisionFromBirthdate(
  birthdate: string | null,
  age: number | null,
): { outcome: VerificationOutcome; underage: boolean } {
  const years = birthdate ? ageFromBirthdate(birthdate) : age;
  if (years !== null && years < 18) {
    return { outcome: "REJECTED", underage: true };
  }
  return { outcome: "VERIFIED_ADULT", underage: false };
}
