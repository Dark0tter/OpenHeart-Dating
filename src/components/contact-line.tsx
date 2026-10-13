import { SUPPORT_EMAIL } from "@/lib/constants/site";

export function ContactLine() {
  return SUPPORT_EMAIL ? (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <span>the Report tool on the Safety page</span>
  );
}
