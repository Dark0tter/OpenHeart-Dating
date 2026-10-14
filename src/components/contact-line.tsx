import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/constants/site";

export function ContactLine() {
  return (
    <>
      <Link href="/support" className="underline">
        our support form
      </Link>
      {SUPPORT_EMAIL && (
        <>
          {" "}
          or{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
            {SUPPORT_EMAIL}
          </a>
        </>
      )}
    </>
  );
}
