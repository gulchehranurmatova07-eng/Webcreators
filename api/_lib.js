// Shared helpers for the WEB-CREATORS order API.
// Files in /api that start with "_" are not deployed as endpoints by Vercel.
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   KV_REST_API_URL / KV_REST_API_TOKEN   added automatically when you connect an
//                                          Upstash Redis database in Vercel → Storage
//   ADMIN_PASSWORD                         the password for /admin
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   optional: get a Telegram message for every new order

const crypto = require("crypto");

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const COOKIE = "wc_admin";
const SESSION_DAYS = 7;

const STATUSES = ["new", "contacted", "inProgress", "done", "cancelled"];

function storageReady() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

// ---------- Redis (Upstash REST) ----------
async function redis(...command) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error("Redis error: " + (data.error || res.status));
  return data.result;
}

async function pipeline(commands) {
  if (!commands.length) return [];
  const res = await fetch(REDIS_URL.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands)
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data)) throw new Error("Redis pipeline error: " + res.status);
  return data.map((r) => {
    if (r.error) throw new Error("Redis error: " + r.error);
    return r.result;
  });
}

// ---------- HTTP helpers ----------
function send(res, status, body, extraHeaders) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if (extraHeaders) for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 50_000) break;
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "");
  return (fwd.split(",")[0] || req.socket?.remoteAddress || "unknown").trim();
}

function query(req) {
  if (req.query) return req.query;
  const url = new URL(req.url, "http://localhost");
  return Object.fromEntries(url.searchParams);
}

// Allow at most `limit` hits per `windowSec` for this key. Returns true if allowed.
async function rateLimit(key, limit, windowSec) {
  const [count] = await pipeline([["INCR", key], ["EXPIRE", key, String(windowSec), "NX"]]);
  return Number(count) <= limit;
}

// ---------- Admin session ----------
function sessionKey() {
  return crypto.createHash("sha256").update("wc-admin:" + ADMIN_PASSWORD).digest();
}

function sign(value) {
  return crypto.createHmac("sha256", sessionKey()).update(value).digest("base64url");
}

function makeToken() {
  const exp = String(Date.now() + SESSION_DAYS * 864e5);
  return exp + "." + sign(exp);
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function passwordMatches(input) {
  if (!ADMIN_PASSWORD) return false;
  const a = crypto.createHash("sha256").update(String(input || "")).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

function readCookie(req, name) {
  const raw = String(req.headers.cookie || "");
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const token = readCookie(req, COOKIE);
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

function sessionCookie(token) {
  const maxAge = token ? SESSION_DAYS * 86400 : 0;
  return `${COOKIE}=${token || ""}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

// ---------- Orders ----------
function clean(value, max) {
  return String(value == null ? "" : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

async function getOrder(id) {
  const raw = await redis("GET", "order:" + id);
  return raw ? JSON.parse(raw) : null;
}

async function saveOrder(order) {
  await redis("SET", "order:" + order.id, JSON.stringify(order));
}

async function notifyTelegram(order) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  const lines = [
    "🆕 New website order — WEB-CREATORS",
    "",
    `👤 ${order.name}`,
    `📞 ${order.phone}`,
    `🏷 ${order.business}`,
    `💰 ${order.budget || "—"}`,
    order.message && order.message !== "—" ? `💬 ${order.message}` : "",
    `🌐 ${order.language || ""}`
  ].filter(Boolean);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: lines.join("\n"), disable_web_page_preview: true })
    });
  } catch (e) {
    console.error("Telegram notify failed", e);
  }
}

module.exports = {
  STATUSES, storageReady, redis, pipeline, send, readBody, clientIp, query, rateLimit,
  makeToken, passwordMatches, isAdmin, sessionCookie, clean, getOrder, saveOrder, notifyTelegram,
  get passwordSet() { return Boolean(ADMIN_PASSWORD); }
};
