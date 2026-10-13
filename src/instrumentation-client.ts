import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/error-reporting";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init(sentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN));
}
