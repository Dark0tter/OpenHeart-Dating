import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/error-reporting";

const JOB_INTERVAL_MS = 60_000;

export async function register() {
  if (process.env.SENTRY_DSN) {
    Sentry.init(sentryOptions(process.env.SENTRY_DSN));
  }

  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "production"
  ) {
    const { missingSettings } = await import("@/lib/startup-check");
    const missing = missingSettings();
    if (missing.length > 0) {
      console.error(
        `[setup] Missing settings: ${missing.join("; ")}. Add them in the hosting dashboard's environment variables.`,
      );
    }
  }

  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "production" &&
    process.env.JOBS !== "off"
  ) {
    const { runJobs } = await import("@/lib/jobs");
    setInterval(() => {
      runJobs().catch((err) => {
        console.error("[jobs]", err);
        Sentry.captureException(err);
      });
    }, JOB_INTERVAL_MS).unref();
  }
}

export const onRequestError = Sentry.captureRequestError;
