# WEB-CREATORS — agency website

The whole site is one file, `index.html`, with the CSS and JS inline. There is no build step: open it in a browser or upload it to any static host (Netlify, Vercel, GitHub Pages). `assets/logo.jpg` is used as the social-share image and the Apple touch icon.

## Editing content

Everything you might want to edit is near the top of the `<script>` block in `index.html`:

| What | Where |
| --- | --- |
| Form destination and Telegram usernames | `CONFIG` |
| Prices | `PLANS` (always in USD) |
| Portfolio projects, links, tags and tiers | `PROJECTS` |
| Every piece of text in all 5 languages (EN, RU, ZH, TR, UZ) | `I18N` |

- **Adding a project:** add an object to the right list in `PROJECTS`. Leave `url` empty to show the "Demo on request" badge. To show a real screenshot instead of the styled placeholder, add `shot: "assets/projects/name.webp"`. Screenshots load lazily.
- **Adding a text string:** add the same key to all five languages in `I18N`. Any key missing from a language falls back to English.

## Language

The site picks the language in this order: a `?lang=ru` URL parameter, then the visitor's saved choice (`localStorage`), then the browser language, then English. The page also updates `<html lang>`, the title, the meta description and the Open Graph tags. Links like `https://your-domain/?lang=uz` open the site straight in that language.

## Quote form

`CONFIG.formEndpoint` is `/api/orders`: requests are saved to the database, appear in the admin panel and are e-mailed to you (see below). The form sends JSON with `name`, `phone`, `business`, `budget`, `message`, `language`, a random `requestId` (so a retry is never saved twice) and the time the form was open. If the endpoint is empty or the server can't save the order, the form opens Telegram with a pre-filled message to `@Webcreators10`, so no request is lost.

## Before going live

Once you have a domain, change `og:image` / `twitter:image` in `<head>` to an absolute URL (for example `https://your-domain/assets/logo.jpg`). Many social networks need an absolute URL to show the preview image.

## Admin panel (`/admin`)

Orders sent from the quote form are saved to a database and shown at `https://www.webcreatorsuz.com/admin`. The panel shows live stats, a 30-day chart, a searchable, filterable, paginated order list, a drag-and-drop status board, internal notes, agreed prices, notification delivery status, CSV export and a Security page. It is available in English, Russian and Uzbek.

Order statuses: **New → Contacted → In discussion → In progress → Completed**, plus **Cancelled**.

### How an order flows

1. The visitor submits the quote form. The browser sends it to `/api/orders` with a random request ID.
2. The server checks the origin, the content type, the size and every field. Spam traps (a hidden field, a minimum fill time) and rate limits (5 per 10 minutes and 20 per day per address) stop bots.
3. The order is saved in Upstash Redis with a unique ID, a sequential number (`WC-0001`, …) and a timestamp. A retried request with the same request ID, or the same content within 10 minutes, returns the first order instead of a copy.
4. The server sends the notification e-mail through **Resend** (and a Telegram message, if set up). Delivery status is stored separately for each order: attempts, last error and next retry.
5. The visitor sees the success message only after the order is saved. A notification failure never removes or blocks a saved order. Transient failures are retried with exponential backoff (2 min, 10 min, 30 min … up to 24 h, 8 attempts). Retries run daily (`/api/cron`) and whenever the dashboard loads. Failed notifications show a red banner in the dashboard, with **Retry** and **Send again** buttons on the order.
6. The e-mail links to `/admin/#order=<id>`. The link only works after signing in.

If the database is not configured, the form falls back to a pre-filled Telegram message, so no request is lost.

### Sign-in security

- Password (`ADMIN_PASSWORD`) plus a **required authenticator-app code (2FA)**. On the first sign-in the panel asks you to scan a QR code with Google Authenticator, Microsoft Authenticator or 1Password, and shows 10 one-time recovery codes. Save them.
- Server-side sessions in `__Host-` cookies (HttpOnly, Secure, SameSite=Strict). Sessions end after 60 minutes of inactivity, after 12 hours in any case, and on logout. Changing `ADMIN_PASSWORD` signs out every session.
- After 5 failed attempts an address is locked for 1 minute, then 2, 4, 8 … up to 60 minutes. Error messages never say which part was wrong.
- Alerts by e-mail (and Telegram, if set up), throttled to avoid floods: repeated failed sign-ins, a sign-in from a new device, 2FA turned on or reset, recovery code used, recovery codes replaced, password changed, bursts of blocked form submissions, and notification failures.
- Every admin action is in the activity log (Security page). The log stores who, what, when and which order, never passwords, codes, tokens or raw IP addresses.

**Lost your phone?** Sign in with a recovery code, then use *Security → Set up a new phone*. **Lost the phone and the recovery codes?** Only the project owner can reset 2FA: Vercel → Storage → your Upstash database → **Data Browser** → delete the key `mfa`. The next sign-in will ask you to set up 2FA again. **Forgot the password?** Set a new `ADMIN_PASSWORD` in Vercel and redeploy. Keep your Vercel and GitHub accounts protected with 2FA, because they control the site.

### Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | What it is |
| --- | --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | yes | Added automatically when you connect **Upstash for Redis** in Vercel → Storage. |
| `ADMIN_PASSWORD` | yes | The admin password. Use 16+ characters and don't reuse it anywhere else. |
| `AUTH_SECRET` | yes | A random value of at least 32 characters, used to sign sessions and to encrypt the 2FA secret. Generate one with `openssl rand -base64 48`. Changing it signs everyone out and requires setting up 2FA again. |
| `RESEND_API_KEY` | for e-mail | API key from resend.com → API Keys, with "Sending access" only. |
| `EMAIL_FROM` | for e-mail | Sender, for example `WebCreators Orders <orders@webcreatorsuz.com>`. The domain must be verified in Resend. |
| `ADMIN_NOTIFICATION_EMAIL` | for e-mail | Where order e-mails and alerts go, for example your Gmail address. Separate several with commas. |
| `CRON_SECRET` | recommended | A random value (`openssl rand -hex 32`). Vercel sends it to the daily retry job. Without it the job refuses to run. |
| `SITE_URL` | optional | Defaults to `https://www.webcreatorsuz.com`. Used for the admin link in e-mails. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | optional | Telegram notifications in addition to e-mail. |

After adding or changing variables: Deployments → ⋯ → **Redeploy**.

### E-mail sending domain (SPF / DKIM / DMARC)

1. resend.com → **Domains** → **Add domain** → `webcreatorsuz.com`.
2. Resend shows DNS records: an MX and a TXT (SPF) record for `send.webcreatorsuz.com`, and a TXT (DKIM) record `resend._domainkey`. Add them in **Cloudflare → DNS** exactly as shown, with the proxy turned off ("DNS only").
3. Add a DMARC record if you don't have one: TXT, name `_dmarc`, value `v=DMARC1; p=none; rua=mailto:<your address>`. After a few weeks with no problems you can make it stricter (`p=quarantine`).
4. Wait until Resend shows **Verified**. Then use an address at that domain in `EMAIL_FROM`.
5. Admin → **Security** → **Send test email**. "Accepted" means Resend took the message. Check the inbox (and spam) to confirm it arrived. Resend → **Emails** shows the delivery log for every message.

### Database and migration

No migration step is needed, and nothing existing is deleted or rewritten. Older orders keep working: they show their internal ID instead of a `WC-` number and are labelled "received before delivery tracking". New keys added: `notify:<id>`, `notify:due`, `orders:seq`, `sess:*`, `sessions`, `mfa`, `audit`, `audit:order:<id>`, `alerts` and short-lived rate-limit keys. Before deploying, download a backup: in the current panel use **Export CSV**; after the upgrade use **Security → Download backup** (JSON).

### Testing locally

```
node tests/api-test.cjs                                    # API, security and notification tests (no network needed)
node tests/serve-local.cjs & node tests/browser-test.cjs   # browser tests; needs Playwright + Chromium
```

The tests use local stand-ins for Redis and Resend with fake data. They never touch production.

| File | What it does |
| --- | --- |
| `admin/index.html`, `admin/app.js` | The admin panel. The script is a separate file so the page can use a strict Content-Security-Policy. |
| `admin/qrcode.js` | QR code generator for the 2FA setup (qrcode-generator 2.0.4, MIT) |
| `api/orders.js` | Save a new order (public) / list, search and filter orders (admin) |
| `api/order.js` | Order details, status, price, notes, notification retry, delete (admin) |
| `api/auth.js` | Sign in, 2FA, logout, sessions |
| `api/admin.js` | Security overview, activity log, backup, test e-mail (admin) |
| `api/cron.js` | Daily notification retry job |
| `api/_lib.js`, `api/_auth.js`, `api/_notify.js` | Shared helpers: database, validation, sessions and 2FA, e-mail and Telegram |
| `vercel.json` | Security headers (CSP, HSTS …), no-cache for admin/API, the daily job |
| `.vercelignore` | Keeps `tests/`, `docs/` and this README off the public site |
