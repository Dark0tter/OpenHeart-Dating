import type { ErrorEvent } from "@sentry/nextjs";

/**
 * Shared Sentry options. Error reports only: no performance tracing, no
 * session replay, and nothing that identifies a member. Request bodies,
 * cookies, headers, query strings, and user fields are stripped before sending.
 */
export function sentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    environment: process.env.NODE_ENV,
    beforeSend(event: ErrorEvent) {
      delete event.user;
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
        delete event.request.data;
        delete event.request.query_string;
      }
      delete event.extra;
      return event;
    },
    beforeBreadcrumb() {
      return null;
    },
  };
}
