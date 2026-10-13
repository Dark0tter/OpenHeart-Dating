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

## Phase roadmap

| Phase | Scope |
| --- | --- |
| **1 (this repo)** | Auth, profiles, tag taxonomies, discovery, likes, matches, messaging, age-verification stubs, block/report, noindex headers |
| **2** | Full kink interest levels UI, advanced filters, photo albums, richer incognito flows |
| **3** | Moderation dashboard, payments (themes/boosts only), analytics, push |
| **4** | Community groups, events, forums, local meetups |

## Important API surfaces

| Route | Purpose |
| --- | --- |
| `POST /api/auth/register` | Email + password + DOB (18+) |
| `POST /api/verification/start` | Start age-verification stub (Persona/Veriff/Stripe/Yoti ready) |
| `GET /api/search` | Tag-filtered search. Incognito profiles only appear after a match, after they liked or messaged you, or via a `PROFILE_ACCESS` grant |
| `POST /api/likes` | Free like → auto-match on reciprocal |
| `GET/POST /api/messages/[matchId]` | Free messaging + read receipts |
| `POST /api/blocks` | Immediate block (likes/messages/match cleared) |
| `POST /api/reports` | Reports with high-priority emergency queue |
| `POST /api/consent` | Grant/deny/revoke `ADULT_ALBUM` or `PROFILE_ACCESS` |

Database migrations live in `prisma/migrations`; `npm run db:setup` applies them (`prisma migrate deploy`) and seeds the tag taxonomies.

## Legal / compliance checklist (ops)

- 18+ enforcement + age verification before adult content
- Consent-based sharing of explicit material
- GDPR / CCPA readiness (data access/deletion workflows — Phase 3)
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

GitHub Actions (`.github/workflows/ci.yml`) runs Prisma validation, typecheck and a production build on every push and PR.

## Hosting target

- App: DigitalOcean App Platform
- DB: DigitalOcean Managed PostgreSQL
- DNS/WAF: Cloudflare
- Domain example: `openheartdating.com`

## Design note

Brand-first landing with Fraunces + Figtree, sage/coral atmosphere — not a purple SaaS template.
