// Shared helpers for the WEB-CREATORS order API.
// Files in /api that start with "_" are not deployed as endpoints by Vercel.
//
// Environment variables (Vercel → Project → Settings → Environment Variables).
// See README.md → "Admin panel" for the full list and how to set each one.
//   KV_REST_API_URL / KV_REST_API_TOKEN   Upstash Redis (added automatically by Vercel → Storage)
//   ADMIN_PASSWORD                         the password for /admin (long and unique)
//   AUTH_SECRET                            random 32+ character secret for sessions and 2FA encryption
//   RESEND_API_KEY, EMAIL_FROM,            e-mail notifications for new orders and security alerts
//   ADMIN_NOTIFICATION_EMAIL
//   SITE_URL                               optional, defaults to https://www.webcreatorsuz.com
//   CRON_SECRET                            optional, protects the daily notification-retry job
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   optional Telegram notifications

const crypto = require("crypto");

const env = (k) => String(process.env[k] || "").trim();
const CFG = {
  redisUrl: env("KV_REST_API_URL") || env("UPSTASH_REDIS_REST_URL"),
  redisToken: env("KV_REST_API_TOKEN") || env("UPSTASH_REDIS_REST_TOKEN"),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  authSecret: env("AUTH_SECRET"),
  siteUrl: (env("SITE_URL") || "https://www.webcreatorsuz.com").replace(/\/+$/, ""),
  resendKey: env("RESEND_API_KEY"),
  resendUrl: env("RESEND_API_URL") || "https://api.resend.com", // overridable for local tests only
  mailFrom: env("EMAIL_FROM"),
  adminEmails: env("ADMIN_NOTIFICATION_EMAIL").split(/[,;\s]+/).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
  cronSecret: env("CRON_SECRET"),
  tgToken: env("TELEGRAM_BOT_TOKEN"),
  tgChat: env("TELEGRAM_CHAT_ID")
};

// Order workflow: NEW → CONTACTED → IN DISCUSSION → IN PROGRESS → COMPLETED (or CANCELLED).
// "done" is the stored key for COMPLETED; it predates this list and existing orders use it.
const STATUSES = ["new", "contacted", "discussion", "inProgress", "done", "cancelled"];
const STATUS_LABELS = { new: "New", contacted: "Contacted", discussion: "In discussion", inProgress: "In progress", done: "Completed", cancelled: "Cancelled" };
const BUSINESS_KEYS = ["restaurant", "hotel", "barber", "market", "clothing", "commerce", "other"];
const BUDGET_KEYS = ["b1", "b2", "b3", "b4", "b5", "b6"];

function storageReady() { return Boolean(CFG.redisUrl && CFG.redisToken); }
function setupState() {
  return {
    storage: storageReady(),
    password: Boolean(CFG.adminPassword),
    secret: CFG.authSecret.length >= 32
  };
}

// ---------- Redis (Upstash REST) ----------
async function redis(...command) {
  const res = await fetch(CFG.redisUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${CFG.redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error("Redis error: " + (data.error || res.status));
  return data.result;
}

async function pipeline(commands) {
  if (!commands.length) return [];
  const res = await fetch(CFG.redisUrl.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${CFG.redisToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data)) throw new Error("Redis pipeline error: " + res.status);
  return data.map((r) => {
    if (r.error) throw new Error("Redis error: " + r.error);
    return r.result;
  });
}

async function getJSON(key) {
  const raw = await redis("GET", key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// MGET in chunks so large order lists don't hit request-size limits.
async function mgetJSON(keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += 400) {
    const raws = await redis("MGET", ...keys.slice(i, i + 400));
    for (const r of raws || []) { try { out.push(r ? JSON.parse(r) : null); } catch { out.push(null); } }
  }
  return out;
}

// ---------- HTTP helpers ----------
const API_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff"
};

function send(res, status, body, extraHeaders) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(API_HEADERS)) res.setHeader(k, v);
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

class HttpError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

// Reads a JSON body. Rejects other content types (blocks HTML-form CSRF) and bodies over `limit` bytes.
async function readBody(req, limit = 16_000) {
  const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new HttpError(415, "unsupported_content_type");
  if (Number(req.headers["content-length"] || 0) > limit) throw new HttpError(413, "payload_too_large");
  let text, parsed;
  // On Vercel req.body is a getter that parses JSON and throws on malformed input.
  try { parsed = req.body; } catch { throw new HttpError(400, "invalid_json"); }
  if (parsed !== undefined && parsed !== null) {
    if (typeof parsed === "object" && !Buffer.isBuffer(parsed)) {
      if (JSON.stringify(parsed).length > limit) throw new HttpError(413, "payload_too_large");
      if (Array.isArray(parsed)) throw new HttpError(400, "invalid_json");
      return parsed;
    }
    text = Buffer.isBuffer(parsed) ? parsed.toString("utf8") : String(parsed);
  } else {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) throw new HttpError(413, "payload_too_large");
      chunks.push(chunk);
    }
    text = Buffer.concat(chunks).toString("utf8");
  }
  if (text.length > limit) throw new HttpError(413, "payload_too_large");
  let v;
  try { v = JSON.parse(text || "{}"); } catch { throw new HttpError(400, "invalid_json"); }
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new HttpError(400, "invalid_json");
  return v;
}

function clientIp(req) {
  // Vercel sets x-real-ip / x-forwarded-for itself; the client cannot spoof them there.
  const real = String(req.headers["x-real-ip"] || "").trim();
  if (real) return real;
  const fwd = String(req.headers["x-forwarded-for"] || "");
  return (fwd.split(",")[0] || req.socket?.remoteAddress || "unknown").trim();
}

// IPs are stored only as keyed hashes.
function ipHash(req) {
  return crypto.createHmac("sha256", CFG.authSecret || "wc").update(clientIp(req)).digest("hex").slice(0, 16);
}

function requestContext(req) {
  const h = (k) => { try { return decodeURIComponent(String(req.headers[k] || "")).slice(0, 60); } catch { return ""; } };
  return {
    ip: ipHash(req),
    country: h("x-vercel-ip-country"),
    city: h("x-vercel-ip-city"),
    ua: String(req.headers["user-agent"] || "").slice(0, 160)
  };
}

function query(req) {
  if (req.query) return req.query;
  const url = new URL(req.url, "http://localhost");
  return Object.fromEntries(url.searchParams);
}

// Same-origin check for state-changing requests (CSRF defence on top of SameSite=Strict cookies).
// Browsers always send Origin on POST/PATCH/DELETE; requests without browser headers carry no cookies.
function sameOrigin(req) {
  const origin = String(req.headers.origin || "");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  if (origin) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  const site = String(req.headers["sec-fetch-site"] || "");
  return !site || site === "same-origin" || site === "none";
}

// Allow at most `limit` hits per `windowSec` for this key. Returns true if allowed.
async function rateLimit(key, limit, windowSec) {
  const [count] = await pipeline([["INCR", key], ["EXPIRE", key, String(windowSec), "NX"]]);
  return Number(count) <= limit;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- validation ----------
// Strips control and bidi-override characters, trims and caps the length.
function clean(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g, "")
    .trim()
    .slice(0, max);
}

const isOrderId = (id) => typeof id === "string" && /^[a-z0-9]{6,32}$/.test(id);

function orderLabel(order) {
  return order.number ? "WC-" + String(order.number).padStart(4, "0") : order.id;
}

// ---------- orders ----------
async function getOrder(id) { return isOrderId(id) ? getJSON("order:" + id) : null; }
async function saveOrder(order) { await redis("SET", "order:" + order.id, JSON.stringify(order)); }

// ---------- audit log ----------
// Who did what to which record. Never pass passwords, codes, tokens or cookie values in `details`.
async function audit(req, session, action, target, details) {
  const ctx = req ? requestContext(req) : null;
  const entry = {
    at: Date.now(),
    actor: session ? "owner" : "system",
    session: session ? session.id.slice(0, 8) : "",
    ip: ctx ? ctx.ip : "",
    country: ctx ? ctx.country : "",
    action,
    target: target || "",
    details: details || null
  };
  const cmds = [["LPUSH", "audit", JSON.stringify(entry)], ["LTRIM", "audit", "0", "4999"]];
  if (target && target.startsWith("order:")) {
    const k = "audit:" + target;
    cmds.push(["LPUSH", k, JSON.stringify(entry)], ["LTRIM", k, "0", "99"]);
  }
  try { await pipeline(cmds); } catch (e) { console.error("audit write failed:", e.message); }
}

// Wraps a handler: consistent errors, no stack traces or internals sent to the client.
function handler(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.code });
      console.error(e);
      return send(res, 500, { error: "server_error" });
    }
  };
}

module.exports = {
  CFG, STATUSES, STATUS_LABELS, BUSINESS_KEYS, BUDGET_KEYS,
  storageReady, setupState, redis, pipeline, getJSON, mgetJSON,
  send, HttpError, readBody, clientIp, ipHash, requestContext, query, sameOrigin, rateLimit, sleep,
  clean, isOrderId, orderLabel, getOrder, saveOrder, audit, handler
};
