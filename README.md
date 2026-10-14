# OpenHeart Dating

Privacy-first dating for LGBTQIA+ people, kink-positive adults, and users with elevated safety needs — without artificial paywalls on likes, messages, matching, or filtering.

**Tagline:** Dating, connection, identity, and kink without artificial paywalls.

## Stack (Phase 1)

- Next.js 15 (App Router) + React + TypeScript
- Tailwind CSS
- NextAuth (Auth.js) credentials auth
- Prisma + PostgreSQL (DigitalOcean-ready; local via Docker)
- Next.js API routes

## Core principles encoded in the product

1. **Inclusive by default** — identity, orientation, goals, body, ethnicity, accessibility, and kink are tag-based. No male/female search columns.
2. **Privacy first** — `PUBLIC` / `LIMITED` / `INCOGNITO` visibility. Incognito profiles are excluded from search, browse, discovery, and public URLs.
3. **Consent-centered** — adult albums require verified-adult status + explicit consent grants.
4. **No messaging paywall** — likes, matches, messages, and filters are free.
5. **Meet by shared interests** — interest rooms first, private chat when it clicks.

## Taxonomies

All preset lists live in `src/lib/constants/tags.ts` and are seeded by `npm run db:setup`: 27 gender identities, 20 orientations, 14 relationship styles, and 341 kinks in 19 categories. Members can also write in their own identity or orientation; write-ins appear on their own profile but never in the shared pick lists.

Adding entries is safe. Renaming an entry, or moving a kink to a different category, creates a new entry and leaves the old one on existing profiles.

Kinks are intentionally excluded if they involve minors, animals, incest, real non-consent, or financial domination.

## Mobile app content policy

The iOS and Android apps run the same code under one policy, built to the stricter of Apple's and Google's rules on every point, so neither platform needs its own version. The server enforces it, so an app can't show more than it's allowed.

- **How the app is detected.** The native shell appends `OpenHeartApp` to its WebView user agent (Capacitor: `appendUserAgent`) and sends `x-openheart-client: app` on direct API calls. See `src/lib/content-policy.ts`.
- **Three content tiers** (`ContentTier`):
  - `STANDARD`: shown everywhere.
  - `ADULT_TEXT`: shown in the apps only to verified adults who turned on "Show the full interest list" on the website. The setting can't be changed from inside the app.
  - `WEB_ONLY`: never shown in the apps.
- **What's web-only:** Edge Play, Caregiver / Little, Teacher/Student roleplay, adult photos, and media in private messages.
- **Where tiers are set:** each kink and category in `src/lib/constants/tags.ts`, and each sponsor ad via `SponsorPlacement.contentTier`. Ads default to `WEB_ONLY` until someone reviews them.
- **Explicit words** in rooms, posts, message requests and private messages are masked in the apps unless the member opted in. See `src/lib/moderation/app-text.ts`.
- **Hidden rooms** don't appear in the app's room list, and the app can't join, read or post in them. Kinks hidden from the app are kept when a member saves their profile from the app.
- **Store requirements also covered:**
  - In-app account deletion (Settings page and `DELETE /api/account`).
  - Accepting the Terms at sign-up.
  - A `/terms` page with a zero-tolerance policy and a 24-hour report-review commitment.
  - A `/child-safety` page (Google Play's Child Safety Standards).
  - A published contact address (`SUPPORT_EMAIL`).

## Themes

Signed-in members choose a theme in Settings: Light, Dark, or Match my device, plus an optional pride flag accent (19 flags, including Rainbow, Progress, Trans, Bi, Pan, Lesbian, Gay men, Nonbinary, Ace, Aro, Intersex, Polyamorous, and Leather). The theme is saved on the account (`User.themeMode`, `User.themeFlag`), so it's the same on the website and in both apps.

Flag colors live in `src/lib/themes.ts`; each flag's accents were picked to meet WCAG AA contrast in both light and dark mode. The public pages (landing, sign-up, terms) keep the default look.

## How people meet

- **Rooms.** Seeding creates a Welcome room, one room per kink category and one per relationship goal. Any member can join any room.
- **Automatic invites.** Saving a profile invites the member to every room matching their interests: kink categories with something marked Favorite, Interested or Curious, plus their goals. Declined invites are never re-sent. No and Hard limit never trigger an invite.
- **Online now.** Each room shows who's been active in the last 90 seconds. Members can hide themselves in Settings; incognito members only appear to people already allowed to see them. Room member lists are otherwise never exposed.
- **Private chat.** Clicking a name in a room lets you send a private message request. Accepting it opens a private conversation.
- **Home feed.** Posts from everyone you've liked or followed, plus your own. Blocked and hidden incognito authors are filtered out.

## Quick start

```bash
# 1. Install
npm install

# 2. Env
cp .env.example .env

# 3. Local Postgres (Docker Desktop required)
npm run db:up

# Or point DATABASE_URL at DigitalOcean Managed Postgres / Neon / any PG 16 URL

# 4. Schema + taxonomy seed
npm run db:setup

# 5. Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build verified with `npm run build`.

## Tests

```bash
npm test          # unit tests: moderation filters, scam signals, ranking, age checks, webhook signatures
npm run test:db   # database tests: needs DATABASE_URL pointing at a disposable, migrated database
```

CI (`.github/workflows/ci.yml`) starts Postgres 16, applies every migration, checks the migrations match `schema.prisma`, seeds, then runs typecheck, lint, both test suites and a production build on every push and pull request.

## What's built

- **Accounts:** email confirmation, password reset and change (signs out other devices), Turnstile bot check, rate limits stored in Postgres, error alerts (Sentry), download-my-data (`GET /api/account/export`) and account deletion.
- **Photos:** re-encoded with location and camera data stripped, safety-scan hook, moderator review before going live, private and adult albums shared only by consent, selfie verification badge.
- **Discovery:** location from the browser or city (rounded to about 1 km), approximate distances, ranking by mutual fit, shared goals and interests, profile prompts, a completeness meter.
- **Messaging:** live updates (Postgres LISTEN/NOTIFY over server-sent events, polling fallback), typing indicators, mutual read receipts, scam warnings, unmatch.
- **Notifications:** in-app bell, web push and email (when away), each switchable in Settings.
- **Community:** interest rooms with hosts (mute, ban, slow mode, pinned notice, rules), events and munches with RSVPs (address only shown to people going).
- **Safety:** date check-ins that email a trusted contact if you don't check in, `/safety` tips, block, report, Persona age verification by signed webhook.
- **Trust and safety staff tools** (`/mod`): report queue with assignment, user history, warnings, suspensions with appeals (decided by a different moderator), photo and selfie review, support tickets, room and event moderation, child-safety escalation that preserves evidence under legal hold, and a full audit log. Make the first admin with `npm run staff:set -- you@example.com ADMIN`.
- **Background jobs** (`src/lib/jobs.ts`): run every minute inside the server, one instance at a time.

## Mobile apps

`mobile/` holds the Capacitor shells for iOS and Android. They load the live website with `OpenHeartApp` added to the user agent, so the server applies the app store content policy below.

```bash
cd mobile && npm install
OPENHEART_URL=https://your-domain npm run sync
npm run ios       # opens Xcode (needs a Mac and an Apple Developer account to publish)
npm run android   # opens Android Studio
```

Before publishing, set the bundle ID (`OPENHEART_APP_ID`, default `com.openheartdating.app`), add app icons and splash screens, and fill in the stores' privacy questionnaires. Web push doesn't work inside the iOS app; native push (APNs and Firebase) is a later addition.

## Important API surfaces

| Route | Purpose |
| --- | --- |
| `POST /api/auth/register` | Email + password + DOB (18+) |
| `POST /api/verification/start` | Start age verification (Persona hosted flow; dev stub without keys) |
| `POST /api/verification/persona-webhook` | Signed Persona result: verified, declined, or under 18 (suspends and reports) |
| `GET/POST/PATCH /api/safety/check-ins` | Date check-ins |
| `DELETE /api/matches/[matchId]` | Unmatch |
| `GET /api/account/export` | Download all your data as JSON |
| `GET/POST /api/events`, `POST /api/events/[id]/rsvp` | Events and munches |
| `GET /api/live` | Live updates (server-sent events) |
| `POST /api/cron` | Run background jobs now (needs `CRON_SECRET`) |
| `GET /api/search` | Tag-filtered search. Incognito profiles only appear after a match, after they liked or messaged you, or via a `PROFILE_ACCESS` grant |
| `POST /api/likes` | Free like → auto-match on reciprocal |
| `GET/POST /api/messages/[matchId]` | Free messaging + read receipts |
| `POST /api/blocks` | Immediate block (likes/messages/match cleared) |
| `POST /api/reports` | Reports with high-priority emergency queue |
| `POST /api/consent` | Grant/deny/revoke `ADULT_ALBUM` or `PROFILE_ACCESS` |
| `GET /api/rooms` | All rooms, with joined / invited / matches-your-profile flags |
| `POST/DELETE /api/rooms/[id]/membership` | Join (accepts any pending invite) or leave a room |
| `DELETE /api/rooms/[id]/invite` | Decline a room invite |
| `GET/POST /api/rooms/[id]/messages` | Room chat (members only, rate limited, solicitation-checked) |
| `GET /api/rooms/[id]/online` | Members active in the room right now |
| `GET/POST /api/message-requests` | Private message requests; accepting opens a conversation |
| `GET /api/feed` | Posts from people you liked or follow |
| `POST/DELETE /api/follows`, `POST /api/posts` | Follow people, write posts |

Database migrations live in `prisma/migrations`; `npm run db:setup` applies them (`prisma migrate deploy`) and seeds the tag taxonomies.

## Revenue and privacy model

Members are the customers, not the product.

- **Always free:** likes, messages, matching, search, filters, safety tools.
- **Sponsor block:** one small labelled block at the bottom of app pages (`SponsorSlot`). It's `GENERIC` by default; members can opt in to `PROFILE_INTERESTS`, which matches only the kinks (Favorite/Interested/Curious) and relationship goals on their profile and skips anything they marked No/Hard Limit. No impressions, clicks, or viewers are stored; links open with `rel="sponsored noopener noreferrer"` and no referrer.
- **Supporter membership** (`Subscription.plan = "supporter"`): option to hide the sponsor block, supporter badge, extra storage, and forum video playback (Phase 4). Never core dating features.
- **No data sales, no third-party trackers, no cross-site tracking.**

## Financial solicitation policy

`src/lib/moderation/solicitation.ts` blocks wishlists (Amazon, Throne), payment links and cashtags (Cash App, Venmo, PayPal.me, Zelle), tip jars (Buy Me a Coffee, Ko-fi), paid-content promotion (OnlyFans, Fansly, Patreon, etc.), and financial domination (findom, paypig, human ATM, etc.) in display names, profiles, and messages. Findom is excluded from the platform entirely and is not in the kink taxonomy. Blocked content isn't saved, and an `AUTOMATED` `FINANCIAL_SOLICITATION` report goes to the moderation queue (HIGH priority after 3 attempts in 30 days). Nothing is banned automatically: warnings, suspensions, and verification-based bans are moderator decisions with appeals. Public pages: `/privacy`, `/guidelines`.

## Legal / compliance checklist (ops)

- 18+ enforcement + age verification before adult content
- Consent-based sharing of explicit material
- GDPR / CCPA: data download and account deletion are built in
- DMCA + ToS + Community Guidelines
- Never permanently store government ID images (tokens + status only)
- Profile pages send `noindex,nofollow` + `X-Robots-Tag`

## Deploying to DigitalOcean

The App Platform spec lives in `.do/app.yaml` and deploys from `main` of
[Dark0tter/OpenHeart-Dating](https://github.com/Dark0tter/OpenHeart-Dating) on every push.

1. Create a managed PostgreSQL 16 cluster named `openheart-db` (same region as the app, `nyc`).
2. Create the app: **Apps → Create App → import `.do/app.yaml`**, or `doctl apps create --spec .do/app.yaml`.
3. In the app's settings, fill in the secret env vars: `AUTH_SECRET` (`openssl rand -base64 32`), plus Persona/Veriff, Stripe and S3 (Spaces) keys when ready.
4. Each deploy runs the `migrate` pre-deploy job (`prisma migrate deploy` + idempotent tag seed) before the web service goes live. `/api/health` checks the database.

Age verification: the stub callback is disabled in production. For a staging test you can set
`ALLOW_VERIFICATION_STUB=true`; set it back to `false` before real users sign up.

GitHub Actions (`.github/workflows/ci.yml`) runs migrations, tests, typecheck, lint and a production build on every push and PR.

## Launch checklist

Things the code can't do for you:

1. **Legal review** of `/terms`, `/privacy`, `/guidelines` and `/child-safety` by a lawyer familiar with adult platforms (US: Section 230, FOSTA-SESTA, 18 U.S.C. 2257 if explicit images are allowed; EU/UK: GDPR, Online Safety Act).
2. **NCMEC CyberTipline** registration as an electronic service provider. US law requires reporting child sexual abuse material you become aware of; the `/mod` escalation preserves evidence, but the report itself is filed on NCMEC's site.
3. **Moderators.** The Terms promise a 24-hour review of reports. Appoint at least two staff (`npm run staff:set`) so appeals can go to someone other than the original moderator.
4. **Accounts and keys:** hosting (DigitalOcean), domain and Cloudflare, email (Resend; verify the sending domain), photo storage (Spaces), Persona (template that collects date of birth, plus a webhook to `/api/verification/persona-webhook`), Turnstile, Sentry, VAPID keys (`npm run vapid:generate`), `CRON_SECRET`, `SUPPORT_EMAIL`.
5. **App stores:** Apple Developer Program ($99/year) and Google Play Console ($25 once). Both review dating apps closely: have a demo account ready, and answer the content questions honestly (the apps never show adult photos).
6. **Before real users:** `ALLOW_VERIFICATION_STUB=false`, `PHOTO_REVIEW_MODE=pre`, a test signup through Persona's sandbox, a test date check-in, and a restore test of the database backup.

## Hosting target

- App: DigitalOcean App Platform
- DB: DigitalOcean Managed PostgreSQL
- DNS/WAF: Cloudflare
- Domain example: `openheartdating.com`

## Design note

Brand-first landing with Fraunces + Figtree, sage/coral atmosphere — not a purple SaaS template.
