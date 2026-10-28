# WEB-CREATORS website: security audit and upgrade (October 2026)

Scope: `www.webcreatorsuz.com`, the public quote form and the `/admin` panel. The audit covers this repository (commit `b0ab84f`, before the upgrade) and the changes on branch `claude/security-upgrade`.
Method: source-code review, plus automated tests against the real API code running locally with stand-ins for Upstash Redis and Resend, plus Playwright browser tests. No tests were run against production or real client data: production was not reachable from the test environment.

## 1. Architecture (unchanged)

- **Hosting:** Vercel. A static site (`index.html`, one file with inline CSS/JS, 5 languages) plus Node.js serverless functions in `/api`. No build step and no npm dependencies.
- **Database:** Upstash Redis over its REST API. Each order is a JSON value `order:<id>`, indexed in the sorted set `orders`.
- **Admin:** static `/admin/index.html` that talks to `/api/auth`, `/api/orders`, `/api/order`.
- **Integrations:** optional Telegram bot notification. Google Fonts on the public site. No analytics, no file uploads, no payments.

## 2. Findings in the original code

| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| 1 | High | **Single factor.** The admin is protected only by one shared password (`ADMIN_PASSWORD`). No 2FA. | Fixed: required TOTP 2FA with encrypted secret, replay protection and one-time recovery codes. |
| 2 | High | **Logout did not end the session.** Sessions were stateless signed timestamps valid for 7 days. Logout only deleted the cookie, so a copied cookie kept working for up to 7 days and could only be revoked by changing the password. | Fixed: random server-side sessions (only hashes stored), deleted on logout. "Sign out other sessions" button. |
| 3 | Medium | **Long sessions, no idle timeout** (7 days). | Fixed: 60-minute idle timeout, 12-hour maximum, new session ID at every sign-in and 2FA change. |
| 4 | Medium | **Cross-site request forgery from a sibling subdomain.** The cookie was SameSite=Strict, but `ai.webcreatorsuz.com` counts as the same site. The API accepted any content type and didn't check the Origin header, so a script running on any `*.webcreatorsuz.com` page could change or delete orders while the admin was signed in. The plain cookie name could also be overwritten from a subdomain. | Fixed: Origin check on every state-changing request, JSON-only bodies (415 otherwise), `__Host-` cookie prefix. |
| 5 | Medium | **Weak brute-force protection.** 10 tries per 15 minutes per address, no progressive delay, no alerting, and disabled if the database was missing. | Fixed: progressive lockout (5 failures → 1, 2, 4 … 60 min), random delay, global counter, alerts. |
| 6 | Medium | **No security headers on the site.** No Content-Security-Policy, Permissions-Policy or `nosniff` on pages. HSTS is not set in `vercel.json` (Vercel may add its own; verify in production). The admin's inline script made a strict CSP impossible. | Fixed: CSP (strict `script-src 'self'` on the admin; the script moved to `admin/app.js`), HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame blocking, COOP. |
| 7 | Medium | **Notifications could be silently lost.** Only an optional Telegram message; failures were swallowed with no record, retry or e-mail. | Fixed: e-mail via Resend plus Telegram, per-order delivery status, bounded exponential retries, daily job, manual retry/resend, idempotency keys, failure alerts. |
| 8 | Low | **Duplicate orders.** A double-click or network retry saved the order twice. | Fixed: request ID plus 10-minute content de-duplication. Exactly-once is covered by tests. |
| 9 | Low | **Weaker spam controls.** Honeypot only; 8 orders per hour per address. | Improved: minimum fill time, 5 per 10 min and 20 per day per address, burst alerts. No CAPTCHA, on purpose: it adds friction for real clients. |
| 10 | Low | **No audit trail.** Status changes, deletions and sign-ins were not logged; deletes left no trace. | Fixed: activity log (actor, action, time, record) with secrets and raw IPs excluded. Per-order history. |
| 11 | Low | **Every order (with internal notes) sent to the browser at once**, up to 1,000; no server-side search or paging. | Fixed: server-side search, filters and pagination; list rows exclude notes. |
| 12 | Low (bug) | **E-commerce orders were stored as "other"**: `commerce` was missing from the server's list of business types. | Fixed. |
| 13 | Low | **Malformed bodies.** Requests over 50 KB were silently truncated, and malformed JSON could produce a 500 on Vercel. | Fixed: 12–16 KB limits with 413, malformed JSON → 400. |
| 14 | Info | `GET /api/auth` tells anonymous visitors which settings are configured (true/false only). | Kept: needed for the setup screen and reveals no values. |

What was already done well and is kept: all admin output was HTML-escaped (no XSS found), CSV export guards against spreadsheet formula injection, password comparison was timing-safe, cookies were HttpOnly/Secure/SameSite, the admin had `noindex`/`no-store`/`DENY`-framing, there was a honeypot, and no secrets were in the code.

Not applicable or nothing found: SQL injection (Redis commands are sent as JSON arrays, never built from strings), file uploads (none), open redirects (none), vulnerable dependencies (no npm dependencies; the bundled `qrcode-generator` 2.0.4 has 0 known advisories), secrets in the repository (none: every credential comes from Vercel environment variables).

## 3. Fixes implemented

**Authentication and sessions** (`api/_auth.js`, `api/auth.js`)
- Password plus TOTP (RFC 6238, verified against the RFC test vector). 2FA setup is required at first sign-in; until then the session can only reach the 2FA setup endpoints.
- The 2FA secret is encrypted with AES-256-GCM using a key derived from `AUTH_SECRET`. Recovery codes are stored as keyed hashes and work once each. Re-setting 2FA requires a current code.
- Sessions: 256-bit random tokens, stored hashed, idle and absolute expiry, deleted on logout, regenerated at sign-in and at 2FA changes. Changing `ADMIN_PASSWORD` invalidates every session.
- Cookies: `__Host-` prefix, HttpOnly, Secure, SameSite=Strict. Nothing auth-related is in localStorage.
- Errors are generic: "invalid credentials" whether or not the password was close.

**Authorization and CSRF**
- Every admin endpoint calls `requireAdmin()`. It checks configuration, then a valid full (2FA) session, then same-origin for writes. Hiding buttons is never relied on.
- Order IDs are validated (`^[a-z0-9]{6,32}$`). Protected fields (`id`, `number`, `createdAt`, client data) can't be changed through the API. Statuses come from a fixed list.

**Public form** (`api/orders.js`, `index.html`)
- Origin check, JSON-only, size limits, field validation and length caps, removal of control and bidi-override characters, honeypot, minimum fill time, rate limits, de-duplication by request ID and content.
- The success message appears only after the database write succeeds. Notifications can't turn a saved order into an error.

**Notifications** (`api/_notify.js`, `api/cron.js`): see section 4.

**Admin dashboard** (`admin/`)
- KPIs: total, new, in progress, completed, cancelled, notification failures, revenue, conversion.
- Search (order number, ID, name, phone, message), filters (status, business type, date range, failed notifications), pagination, a CSV export of all pages with the current filters.
- Order detail: number, timestamps, delivery status per channel with Retry / Send again, a history merged from status changes and the audit log, and internal notes.
- New "In discussion" status, a 6-column board, a failure banner, deep links from e-mails (`/admin/#order=<id>`).
- Security page: 2FA status, recovery codes left, active sessions, "sign out other sessions", e-mail/Telegram/cron status, test e-mail, JSON backup download, recent alerts, activity log.

**Monitoring and alerts:** repeated failed sign-ins (per address and overall), new-device sign-in, 2FA set up or reset, recovery code used or replaced, password changed, bursts of blocked form submissions, notification failures. Alerts are throttled per type and stored for the dashboard.

**Headers** (`vercel.json`): see finding 6. `/admin` and `/api` are `no-store` and `noindex`.

## 4. Order notification workflow

1. The form posts the order. The server validates it, saves `order:<id>` and gives it the next number (`WC-0001` …).
2. The server sends one e-mail to `ADMIN_NOTIFICATION_EMAIL` through the Resend HTTPS API, with `Idempotency-Key: wc-order-<id>-v<n>`, and a Telegram message if configured. A per-order lock prevents parallel sends.
3. Within the request: up to 2 attempts with a short backoff for transient errors (timeouts, 429, 5xx). Permanent errors such as an unverified domain are not retried immediately.
4. Status per channel is stored in `notify:<id>`: `sent` / `failed` / `not_configured`, attempts, last error (with secrets removed), next retry.
5. Failed channels go into `notify:due`. They are retried by `/api/cron` (daily on the Hobby plan) and whenever the dashboard is opened, with backoff of 2 min, 10 min, 30 min, 1 h, 3 h, 6 h, 12 h and 24 h, up to 8 attempts. After that, only a manual retry.
6. Admin → order → **Retry** sends only channels that haven't been sent. **Send again** (with confirmation) sends one more copy with a new idempotency key. Both are rate-limited and logged.
7. When a notification fails, the dashboard shows a banner and an alert goes out through the other channel.

E-mail template: subject `[WebCreators] New Client Order — Order #WC-0001`. The body follows the requested template using the fields the form actually collects: order ID, date and time (UTC and Tashkent), service, client name, phone, project description, budget, language, status, and the admin link. The form has no e-mail or deadline field, so those lines are left out rather than invented.

## 5. Test results

Automated: `node tests/api-test.cjs` gave **35/35 passed**. `tests/browser-test.cjs` (Chromium, desktop 1440×900 and mobile 390×844) gave **30/30 passed**.

| # | Acceptance criterion | Result |
| --- | --- | --- |
| 1 | Public site works on desktop and mobile | PASS (local): renders, no horizontal overflow, language switch, no CSP violations or JS errors |
| 2 | Existing forms and pages work | PASS (local): real form submission through the UI shows success |
| 3 | Unauthenticated users can't reach admin pages/APIs | PASS: every admin endpoint returns 401; forged and legacy cookies are rejected |
| 4 | A normal user can't get admin rights | PASS: there is no registration endpoint; a password-only session can't reach data until 2FA |
| 5 | Direct API calls can't bypass authorization | PASS: tested with raw HTTP requests, including cross-origin writes (403) |
| 6 | Repeated logins are rate-limited | PASS: lockout after 5 failures applies even to the correct password; other addresses are unaffected |
| 7 | Inputs validated; injection handled | PASS: bad phone or name, wrong content type, oversize body, malformed JSON, `<script>`/`onerror` and SQL-style payloads stored as text and shown escaped (no dialog fired) |
| 8 | An accepted order is saved exactly once | PASS: same request ID and same content both return the original order |
| 9 | A test order appears in the dashboard | PASS (local) |
| 10 | A test order triggers an e-mail | PASS (local, mock Resend). **NOT TESTED** with the real Resend account and inbox |
| 11 | The e-mail has the correct ID and details | PASS (local): subject, every field, admin link, HTML escaping |
| 12 | Failures are recorded and can be retried | PASS: 500/422 outages, manual retry, the scheduled job |
| 13 | Retrying doesn't duplicate orders or e-mails | PASS: a retry after success sends nothing; resend sends exactly one; idempotency key honoured |
| 14 | No access to another client's order | PASS: all order reads are admin-only; the public endpoint returns only the new ID |
| 15 | Logout invalidates the session | PASS: the old cookie returns 401 after logout |
| 16 | No secrets in bundles, responses or git | PASS: code review plus a test that searches stored logs, alerts and sessions for the password, 2FA secret, codes, tokens, API keys and raw IPs |
| 17 | Headers and cookies verified in the deployed environment | **NOT TESTED**: production can't be reached from here. Verified locally under the same `vercel.json`. |
| 18 | Migrations and backups handled safely | PASS: no destructive migration; older orders load and display correctly; JSON backup tested |
| 19 | Automated tests and security checks pass | PASS: 65/65; `npm audit` on the one bundled library shows 0 vulnerabilities |
| 20 | No critical/high issues in production | **NOT TESTED** until deployed and checked with the steps below |

## 6. Remaining risks and recommendations

- **One shared admin account.** There is a single password and a single authenticator, with no per-person accounts or roles. If more people need access, add individual accounts.
- **Setting up 2FA right after deploying.** Until 2FA is set up, the password alone can enrol an authenticator. An alert e-mail is sent when that happens.
- **Whoever controls Vercel, GitHub or Upstash controls the site and the data,** including the audit log. Turn on 2FA on all three. Treat `KV_REST_API_TOKEN` and `RESEND_API_KEY` as secrets, and rotate them if they are ever exposed.
- **The public site's CSP allows inline scripts**, because the whole site is one inline script and per-edit hashes would break content updates. The admin panel has a strict CSP.
- **Rate limits are per address.** A distributed bot can still send spam. If that happens, add Cloudflare Turnstile to the form.
- **Retry timing.** On Vercel Hobby the cron runs once a day, so an unretried failure can wait until the dashboard is opened or the next day. Upgrade, or point an external scheduler at `/api/cron` with the `CRON_SECRET` header, for hourly retries.
- **"Accepted by Resend" is not the same as "in the inbox".** Confirm with the test e-mail and Resend's Emails log.
- **Client data is kept indefinitely.** Phone numbers are personal data; consider a retention period and deleting old cancelled orders after exporting them.
