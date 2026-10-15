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

When `CONFIG.formEndpoint` is empty, submitting the form opens Telegram with a pre-filled message to `@Webcreators10`. To receive requests by e-mail instead, create a free form on a service such as Formspree and paste its endpoint URL into `formEndpoint`. The form sends JSON with `name`, `phone`, `business`, `budget`, `message` and `language`.

## Before going live

Once you have a domain, change `og:image` / `twitter:image` in `<head>` to an absolute URL (for example `https://your-domain/assets/logo.jpg`). Many social networks need an absolute URL to show the preview image.

## Admin panel (`/admin`)

Orders sent from the quote form are saved to a database and shown at `https://your-domain/admin`, behind a password. The panel has live stats, a 30-day chart, a searchable order list, a drag-and-drop status board, notes, agreed prices and CSV export, in English, Russian and Uzbek.

How it works: the form posts to `/api/orders` (Vercel serverless functions in `/api`). If the database isn't set up yet, the form falls back to Telegram, so no request is lost.

### One-time setup in Vercel

1. **Database:** Vercel → your project → **Storage** → **Create Database** → **Upstash for Redis** (free plan) → connect it to this project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
2. **Password:** Vercel → **Settings → Environment Variables** → add `ADMIN_PASSWORD` with a long password only you know.
3. **Redeploy:** Deployments → ⋯ on the latest one → **Redeploy**.
4. Optional, Telegram alert for every new order: add `TELEGRAM_BOT_TOKEN` (create a bot with @BotFather) and `TELEGRAM_CHAT_ID` (your chat ID, e.g. from @userinfobot), then redeploy.

| File | What it does |
| --- | --- |
| `admin/index.html` | The admin panel |
| `api/orders.js` | Save a new order (public) / list orders (admin) |
| `api/order.js` | Update status, price, notes / delete (admin) |
| `api/auth.js` | Log in / log out |
| `api/_lib.js` | Shared helpers (database, sessions, rate limits) |
| `vercel.json` | Keeps `/admin` and `/api` out of Google and blocks framing |
