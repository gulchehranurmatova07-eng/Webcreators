// Order notifications (e-mail via Resend, optional Telegram) and admin security alerts.
//
// Delivery state lives in its own key, notify:<orderId>, so it never races with admin edits to the order:
//   { email: Channel, telegram: Channel }
//   Channel = { status: "pending"|"sending"|"sent"|"failed"|"not_configured", attempts, gen,
//               lastAttemptAt, lastError, sentAt, providerId, nextRetryAt }
// Failed channels are queued in the sorted set notify:due (score = next retry time) and retried with
// bounded exponential backoff by /api/cron and when the admin dashboard loads.

const L = require("./_lib");
const { CFG } = L;

const MAX_AUTO_ATTEMPTS = 8;
const BACKOFF_MIN = [2, 10, 30, 60, 180, 360, 720, 1440]; // minutes before the next automatic retry
const SEND_TIMEOUT_MS = 6000;

const emailConfigured = () => Boolean(CFG.resendKey && CFG.mailFrom && CFG.adminEmails.length);
const telegramConfigured = () => Boolean(CFG.tgToken && CFG.tgChat);

const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Keeps provider errors short and free of secrets before they are stored or shown.
const scrub = (s) => String(s || "").replace(/re_[A-Za-z0-9_]{8,}/g, "re_***").replace(/bot\d+:[\w-]+/g, "bot***").slice(0, 240);

async function withTimeout(url, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// ---------- providers ----------
// Returns { ok, id } or { ok: false, transient, error }.
async function sendEmail({ subject, text, html, idempotencyKey }) {
  if (!emailConfigured()) return { ok: false, transient: false, error: "not_configured" };
  try {
    const headers = { Authorization: `Bearer ${CFG.resendKey}`, "Content-Type": "application/json" };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 256);
    const res = await withTimeout(CFG.resendUrl + "/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({ from: CFG.mailFrom, to: CFG.adminEmails, subject, text, html })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) return { ok: true, id: String(data.id) };
    const transient = res.status === 429 || res.status >= 500;
    return { ok: false, transient, error: scrub(`HTTP ${res.status}: ${data.name || ""} ${data.message || ""}`.trim()) };
  } catch (e) {
    return { ok: false, transient: true, error: scrub(e.name === "AbortError" ? "timeout" : "network error: " + e.message) };
  }
}

async function sendTelegram(text) {
  if (!telegramConfigured()) return { ok: false, transient: false, error: "not_configured" };
  try {
    const res = await withTimeout(`https://api.telegram.org/bot${CFG.tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: CFG.tgChat, text, disable_web_page_preview: true })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true, id: String(data.result?.message_id || "") };
    return { ok: false, transient: res.status === 429 || res.status >= 500, error: scrub(`HTTP ${res.status}: ${data.description || ""}`) };
  } catch (e) {
    return { ok: false, transient: true, error: scrub(e.name === "AbortError" ? "timeout" : "network error: " + e.message) };
  }
}

// ---------- order e-mail ----------
function adminOrderUrl(order) { return `${CFG.siteUrl}/admin/#order=${encodeURIComponent(order.id)}`; }

function orderEmail(order) {
  const when = new Date(order.createdAt);
  const stamp = when.toISOString().replace("T", " ").slice(0, 16) + " UTC (" +
    when.toLocaleString("en-GB", { timeZone: "Asia/Tashkent", dateStyle: "medium", timeStyle: "short" }) + " Tashkent)";
  const has = (v) => v && v !== "—";
  // Only fields the website form actually collects. The form has no e-mail or deadline field.
  const rows = [
    ["Order ID", `${L.orderLabel(order)}  (internal ID: ${order.id})`],
    ["Date and time", stamp],
    ["Service requested", order.business],
    ["Client name", order.name],
    ["Phone or Telegram", order.phone],
    ["Project description", has(order.message) ? order.message : "—"],
    ["Estimated budget", has(order.budget) ? order.budget : "—"],
    ["Preferred language", order.language || "—"],
    ["Order status", L.STATUS_LABELS[order.status] || "New"]
  ];
  const url = adminOrderUrl(order);
  const subject = `[WebCreators] New Client Order — Order #${L.orderLabel(order)}`;
  const text = [
    "NEW CLIENT ORDER RECEIVED", "",
    ...rows.map(([k, v]) => `${k}: ${v}`), "",
    "ADMIN ACTION:", "View this order in the WebCreators admin panel:", url, "",
    "This is an internal business notification from www.webcreatorsuz.com."
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e3e8f2">
<tr><td style="background:#0a1020;color:#fff;padding:18px 24px;font-size:13px;letter-spacing:2px;font-weight:bold">WEB-CREATORS · NEW CLIENT ORDER RECEIVED</td></tr>
<tr><td style="padding:20px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.5">
${rows.map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;color:#5b6478;white-space:nowrap;vertical-align:top;width:170px">${escHtml(k)}</td><td style="padding:7px 0;white-space:pre-wrap;word-break:break-word">${escHtml(v)}</td></tr>`).join("")}
</table>
<p style="margin:22px 0 6px;font-size:12px;font-weight:bold;letter-spacing:1px;color:#5b6478">ADMIN ACTION</p>
<p style="margin:0 0 8px"><a href="${escHtml(url)}" style="display:inline-block;background:#2f80ff;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:bold">View this order in the admin panel</a></p>
<p style="margin:0;font-size:12px;color:#8a93a6;word-break:break-all">${escHtml(url)}</p>
</td></tr>
<tr><td style="padding:14px 24px;background:#f7f9fc;color:#8a93a6;font-size:12px">Internal business notification from www.webcreatorsuz.com. Sign-in to the admin panel is required to open the order.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

function orderTelegram(order) {
  const has = (v) => v && v !== "—";
  return [
    `🆕 New website order ${L.orderLabel(order)} — WEB-CREATORS`, "",
    `👤 ${order.name}`, `📞 ${order.phone}`, `🏷 ${order.business}`, `💰 ${has(order.budget) ? order.budget : "—"}`,
    has(order.message) ? `💬 ${order.message}` : "", `🌐 ${order.language || ""}`, "", adminOrderUrl(order)
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
}

// ---------- order notification state machine ----------
const blankChannel = () => ({ status: "pending", attempts: 0, gen: 0, lastAttemptAt: null, lastError: null, sentAt: null, providerId: null, nextRetryAt: null });

async function getNotifyState(id) {
  const raw = await L.getJSON("notify:" + id);
  const s = raw || {};
  // recorded=false: the order predates notification tracking
  return { recorded: Boolean(raw), email: { ...blankChannel(), ...(s.email || {}) }, telegram: { ...blankChannel(), ...(s.telegram || {}) } };
}

const CHANNELS = {
  email: { configured: emailConfigured, send: (order, ch) => sendEmail({ ...orderEmail(order), idempotencyKey: `wc-order-${order.id}-v${ch.gen}` }) },
  telegram: { configured: telegramConfigured, send: (order) => sendTelegram(orderTelegram(order)) }
};

// Sends (or retries) the notifications for one order. Idempotent:
//  - a per-order lock stops concurrent sends;
//  - channels already "sent" are skipped unless `force` (an explicit admin "send again");
//  - Resend receives an Idempotency-Key, so a retry after a lost response is not delivered twice.
// Never throws: a delivery failure must not affect the saved order.
async function notifyOrder(order, { force = false, inlineAttempts = 2, channels = ["email", "telegram"] } = {}) {
  const lockKey = "nlock:" + order.id;
  try {
    const got = await L.redis("SET", lockKey, "1", "NX", "PX", "45000");
    if (!got) return { busy: true };
  } catch (e) { console.error("notify lock failed:", e.message); return { error: true }; }

  let state;
  const failedNow = [];
  try {
    state = await getNotifyState(order.id);
    state.recorded = true;
    for (const name of channels) {
      const ch = state[name], def = CHANNELS[name];
      if (!def.configured()) { if (ch.status !== "sent") Object.assign(ch, { status: "not_configured", nextRetryAt: null }); continue; }
      if (ch.status === "sent" && !force) continue;
      if (ch.status === "sent" && force) ch.gen++;
      for (let i = 0; i < inlineAttempts; i++) {
        if (i) await L.sleep(600 * i);
        ch.attempts++;
        ch.lastAttemptAt = Date.now();
        const r = await def.send(order, ch);
        if (r.ok) { Object.assign(ch, { status: "sent", sentAt: Date.now(), providerId: r.id || null, lastError: null, nextRetryAt: null }); break; }
        ch.status = "failed";
        ch.lastError = r.error;
        if (!r.transient) break;
      }
      if (ch.status === "failed") {
        ch.nextRetryAt = ch.attempts < MAX_AUTO_ATTEMPTS ? Date.now() + BACKOFF_MIN[Math.min(ch.attempts, BACKOFF_MIN.length) - 1] * 60_000 : null;
        failedNow.push(name);
      }
    }
    const due = ["email", "telegram"].map((n) => state[n]).filter((c) => c.status === "failed" && c.nextRetryAt).map((c) => c.nextRetryAt);
    await L.pipeline([
      ["SET", "notify:" + order.id, JSON.stringify({ email: state.email, telegram: state.telegram })],
      due.length ? ["ZADD", "notify:due", String(Math.min(...due)), order.id] : ["ZREM", "notify:due", order.id]
    ]);
  } catch (e) {
    console.error("notify failed:", e.message);
  } finally {
    await L.redis("DEL", lockKey).catch(() => {});
  }

  if (failedNow.length) {
    const lines = failedNow.map((n) => `${n}: ${state[n].lastError || "unknown error"} (attempt ${state[n].attempts})`);
    await adminAlert({
      type: "notify_failed", key: "any", throttleSec: 3600,
      subject: "Order notification could not be delivered",
      lines: [`Order ${L.orderLabel(order)} was saved, but a notification failed.`, ...lines, "", "Open the admin panel to retry:", adminOrderUrl(order)],
      // don't use the channel that just failed to report its own failure
      skip: failedNow
    });
  }
  return { state };
}

// Retries notifications whose backoff has expired. Bounded so it can run inside a request.
async function retryDue(limit = 3) {
  const now = Date.now();
  const ids = (await L.redis("ZRANGE", "notify:due", "-inf", String(now), "BYSCORE", "LIMIT", "0", String(limit))) || [];
  let done = 0;
  for (const id of ids) {
    const order = await L.getOrder(id);
    if (!order) { await L.redis("ZREM", "notify:due", id); continue; }
    const st = await getNotifyState(id);
    const chans = ["email", "telegram"].filter((n) => st[n].status === "failed" && st[n].nextRetryAt && st[n].nextRetryAt <= now);
    if (!chans.length) { await L.redis("ZREM", "notify:due", id); continue; }
    await notifyOrder(order, { channels: chans, inlineAttempts: 1 });
    done++;
  }
  return done;
}

// ---------- admin alerts ----------
// Sends at most one alert per (type, key) per throttle window, and keeps the last 200 alerts
// for the dashboard. Lines must not contain passwords, codes, tokens or session IDs.
async function adminAlert({ type, key = "", subject, lines = [], throttleSec = 3600, skip = [] }) {
  try {
    const first = await L.redis("SET", `alert:${type}:${key}`, "1", "NX", "EX", String(throttleSec));
    const entry = { at: Date.now(), type, subject, lines: lines.slice(0, 12), sent: Boolean(first) };
    await L.pipeline([["LPUSH", "alerts", JSON.stringify(entry)], ["LTRIM", "alerts", "0", "199"]]);
    if (!first) return false;
    const text = ["WEB-CREATORS admin security alert", "", ...lines, "", `Time: ${new Date().toISOString()}`].join("\n");
    const jobs = [];
    if (!skip.includes("email")) jobs.push(sendEmail({ subject: `[WebCreators] Security alert — ${subject}`, text, html: `<pre style="font:14px/1.5 Arial,sans-serif;white-space:pre-wrap">${escHtml(text)}</pre>` }));
    if (!skip.includes("telegram")) jobs.push(sendTelegram("⚠️ " + subject + "\n\n" + lines.join("\n")));
    await Promise.all(jobs);
    return true;
  } catch (e) {
    console.error("alert failed:", e.message);
    return false;
  }
}

module.exports = {
  emailConfigured, telegramConfigured, sendEmail, sendTelegram, orderEmail, adminOrderUrl,
  getNotifyState, notifyOrder, retryDue, adminAlert, MAX_AUTO_ATTEMPTS
};
