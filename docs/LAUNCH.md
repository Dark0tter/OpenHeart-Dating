# Launch guide

Everything the code can't do for you, in the order to do it, cheapest first.
Prices are what each service listed when this was written; check before paying.

## Stage 1: free, do now

| What | Cost | Why |
| --- | --- | --- |
| Cloudflare account (DNS, Turnstile) | Free | DNS, DDoS protection, bot check on signup (`TURNSTILE_*`) |
| Resend account | Free tier | Sign-in and alert emails (`RESEND_API_KEY`, `EMAIL_FROM`); verify your domain |
| Sentry account | Free developer tier | Error alerts (`SENTRY_DSN`) |
| Firebase project | Free | Android notifications (`FCM_SERVICE_ACCOUNT_JSON`, `google-services.json`) |
| Push keys for the website | Free | `npm run vapid:generate` |
| NCMEC CyberTipline registration | Free | US law requires reporting child abuse material you find; register as an electronic service provider at report.cybertip.org |
| `SUPPORT_EMAIL` | Free | Any inbox you check; both app stores require a safety contact |

## Stage 2: about $25-40 a month, to go live on the web

| What | Cost | Notes |
| --- | --- | --- |
| Domain | ~$10-15/year | Buy through Cloudflare Registrar (sold at cost) |
| DigitalOcean App Platform | ~$5-12/month | Deploys from `main` using `.do/app.yaml` |
| DigitalOcean Managed Postgres | ~$15/month | Daily backups included; do one restore test before launch |
| DigitalOcean Spaces (photos) | ~$5/month | 250 GB included |
| DMCA agent registration | $6 every 3 years | US Copyright Office online form; protects you when members upload someone else's photos |
| Persona (age and photo checks) | Ask sales | Request startup pricing; until then, adult photos stay locked for everyone, which is the safe default |

Before real members sign up:

- `ALLOW_VERIFICATION_STUB=false` and `PHOTO_REVIEW_MODE=pre`.
- Make yourself admin: `npm run staff:set -- you@example.com ADMIN`, then turn on notifications in Settings on your phone.
- Do one test signup through Persona's sandbox, one test date check-in, and one test call between two accounts.

## Stage 3: legal, before advertising the site

- **Business entity.** An LLC keeps your personal savings separate from the site. State filing fees run roughly $50-500. The tax ID (EIN) is free from the IRS. Payment processors and Apple's organization accounts will ask for both.
- **Lawyer review** of `/terms`, `/privacy`, `/guidelines` and `/child-safety`. Look for an attorney who works with adult platforms; many offer flat-fee document reviews. Topics to raise:
  - Section 230 and FOSTA-SESTA.
  - 18 U.S.C. 2257 record keeping, since members can post explicit photos on the website.
  - State age-verification laws, which Persona checks are meant to satisfy.
  - GDPR and the UK Online Safety Act, if you accept members from Europe or the UK.
- **Sponsor contracts.** A one-page agreement saying sponsors get anonymous daily totals only, no member data, and you can pull an ad at any time.

## Stage 4: phone apps

| What | Cost | Notes |
| --- | --- | --- |
| Apple Developer Program | $99/year | Fee waivers exist for some nonprofits |
| Google Play Console | $25 once | |
| Apple push key (APNs) | Free with the Apple account | Certificates, Identifiers & Profiles → Keys → new key with Apple Push Notifications. Fill in `APNS_*` |
| Xcode | Free | Open `mobile/ios`, confirm the Push Notifications capability is on for the App target, set your team |
| `google-services.json` | Free | Download from Firebase, put it in `mobile/android/app/` (it's ignored by git on purpose) |

Store review tips:

- Give reviewers a demo account that has a match and a conversation.
- Answer the content questions honestly: the apps never show adult photos, sponsors in the apps are always general-audience, and the apps have no purchases, donations or paid perks of any kind.
- Fill in Apple's App Privacy section and Google's Data safety form from `/privacy`. You collect: email, profile content, approximate location (if shared), photos, and messages. You don't track or sell any of it.
- Point out that block, report, account deletion, and the 18+ age check are all built in. Reviewers look for these on dating apps.

## Stage 5: only when needed

- **Relay server for calls (TURN).** Most calls connect directly. Some mobile networks block that, and those calls need a relay. Options, cheapest first:
  - Run coturn yourself on a ~$4-6/month droplet.
  - Use a pay-per-gigabyte service such as Cloudflare's TURN or Metered.

  Then fill in `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL`. Wait until members report calls failing to connect.
- **Taking donations (website only).** Donations are voluntary and never required. The apps don't show or mention them, so Apple and Google take no cut and there's nothing for their reviewers to flag. Stripe's rules ban dating sites with adult content and fetish services, so don't use it (leave `STRIPE_SECRET_KEY` empty). Adult-friendly processors are CCBill, Segpay, Epoch and Verotel; ask each whether they support one-off donations or "tips" for a for-profit site, since some only do subscriptions. Expect an application review, a setup fee from some, and higher fees than mainstream processors. Unless you form a registered nonprofit, donations are business income, not tax-deductible gifts; the site already says so. Until a processor is connected, give donors the badge by hand from `/mod/users/<id>`. Once one is chosen, its webhook calls `grantSupporter` / `endSupporter` in `src/lib/supporter.ts`.
- **Moderators.** One admin can run the site with phone alerts and the daily summary email. Add moderators when the daily summary regularly lists more than you can review in 24 hours.
