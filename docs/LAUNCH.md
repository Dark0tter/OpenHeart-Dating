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
| Age verification | Free to start | Didit: 500 free checks a month, then about $0.33 each. Persona (startup program) and Veriff are drop-in alternatives |

### Connecting kindredkinks.com (DNS on Cloudflare)

1. App Platform keeps its own copy of the app settings and doesn't re-read `.do/app.yaml` on each push. If the app already exists, apply the file once: App Platform → your app → Settings → App Spec → Edit, paste the contents of `.do/app.yaml`, and save (or `doctl apps update <app-id> --spec .do/app.yaml`). It lists `kindredkinks.com` (primary) and `www.kindredkinks.com`. In App Platform → Settings → Domains, each shows a CNAME target like `kindredkinks-xxxxx.ondigitalocean.app`.
2. In Cloudflare → DNS, add a `CNAME` for `@` and one for `www`, both pointing at that target. Leave them **DNS only (grey cloud)** until App Platform shows the domains as active and has issued certificates; then you can switch to Proxied if you want, with SSL/TLS mode set to **Full (strict)**.
3. `APP_URL` follows the primary domain automatically, so sign-in links and emails will use `https://kindredkinks.com`.
4. Email: in Resend, add the domain `kindredkinks.com` and copy the DKIM, SPF and return-path records it gives you into Cloudflare DNS (DNS only). `EMAIL_FROM` is already `Kindred Kinks <hello@kindredkinks.com>`. Add a DMARC record too (`TXT _dmarc` → `v=DMARC1; p=none; rua=mailto:you@yourmail`) so mail isn't flagged as spam.
5. Turnstile: add `kindredkinks.com` to the site's allowed hostnames.
6. For a support inbox, Cloudflare Email Routing (free) can forward `support@kindredkinks.com` and `hello@kindredkinks.com` to your personal email; set `SUPPORT_EMAIL=support@kindredkinks.com`.

Before real members sign up:

- `ALLOW_VERIFICATION_STUB=false` and `PHOTO_REVIEW_MODE=pre`.
- Make yourself owner: `npm run staff:set -- you@example.com OWNER` (after verifying your age on the site). The first time you open `/owner` or `/mod` you'll be asked to set up two-step sign-in with an authenticator app; save the recovery codes somewhere safe (if you lose both, `npm run two-step:reset -- you@example.com`). Then turn on notifications in Settings on your phone. Promote and demote moderators from `/owner/staff`.
- Pick your first city and promote there. Point people elsewhere to `/waitlist`; the owner Cities page shows where demand is building.
- Do one test signup through the verification provider's sandbox and confirm the session disappears from its dashboard afterwards, one test date check-in, and one test call between two accounts.

## Stage 3: legal, before advertising the site

- **Business entity: done.** Kindred Kinks is operated by CertiScan.IS Inc., a Delaware corporation; the Terms, Privacy page and footers say so (change it in `src/lib/constants/site.ts`). Things that come with it:
  - Delaware's annual report and franchise tax are due every March 1 (at least $225 a year: $175 minimum tax plus the $50 filing fee, using the authorized-shares method for small share counts). Keep a registered agent in Delaware.
  - If you run the company from another state, that state may require registering it there as a "foreign corporation".
  - Get the company's EIN (free from the IRS) and a D-U-N-S number (free from Dun & Bradstreet). Apple requires the D-U-N-S number to enroll as an organization, so the stores show "CertiScan.IS Inc." as the seller instead of your personal name.
  - Register the DMCA agent and the NCMEC CyberTipline account in the company's name. The DMCA form needs an address; a registered agent's or a P.O. box works if you don't want your home address public.
- **Lawyer review** of `/terms`, `/privacy`, `/guidelines` and `/child-safety`. Look for an attorney who works with adult platforms; many offer flat-fee document reviews. Topics to raise:
  - Section 230 and FOSTA-SESTA.
  - 18 U.S.C. 2257 record keeping, since members can post explicit photos on the website.
  - State age-verification laws, which the ID checks are meant to satisfy.
  - GDPR and the UK Online Safety Act, if you accept members from Europe or the UK.
- **Sponsor contracts.** Businesses can reach you from `/advertise`; inquiries land on the owner Ads page. Use a one-page agreement saying sponsors get anonymous daily totals only, no member data, and you can pull an ad at any time.

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
- **Taking donations (website only).** Donations are voluntary and never required. The apps don't show or mention them, so Apple and Google take no cut and there's nothing for their reviewers to flag. Stripe's rules ban dating sites with adult content and fetish services, so don't use it. Adult-friendly processors are CCBill, Segpay, Epoch and Verotel; ask each whether they support one-off donations or "tips" for a for-profit site, since some only do subscriptions. Expect an application review, a setup fee from some, and higher fees than mainstream processors. Unless you form a registered nonprofit, donations are business income, not tax-deductible gifts; the site already says so. Until a processor is connected, give donors the badge by hand from `/mod/users/<id>`. Once one is chosen, its webhook calls `grantSupporter` / `endSupporter` in `src/lib/supporter.ts`.
- **Moderators.** One admin can run the site with phone alerts and the daily summary email. Add moderators when the daily summary regularly lists more than you can review in 24 hours.
