import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/error-reporting";

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init(sentryOptions(process.env.SENTRY_DSN));
}

export const onRequestError = Sentry.captureRequestError;
