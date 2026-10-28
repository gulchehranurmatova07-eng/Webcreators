// Admin authentication: password + TOTP two-factor, server-side sessions, brute-force protection.
//
// Sessions are random tokens. Only their SHA-256 hash is stored (sess:<hash>), so a database leak does
// not leak usable cookies. Each session has an idle timeout and an absolute lifetime, is replaced on
// every sign-in and is deleted on logout. Changing ADMIN_PASSWORD signs out every session.
//
// Cookies use the __Host- prefix (Secure, Path=/, no Domain), so subdomains such as
// ai.webcreatorsuz.com can neither read nor overwrite them.

const crypto = require("crypto");
const L = require("./_lib");
const N = require("./_notify");
const { CFG } = L;

const SESSION_COOKIE = "__Host-wc_admin";
const PRE_COOKIE = "__Host-wc_pre";      // short-lived "password OK, waiting for 2FA code" ticket
const DEVICE_COOKIE = "__Host-wc_dev";   // remembers browsers that signed in before (new-device alerts)
const IDLE_MS = 60 * 60_000;             // sign out after 1 hour without activity
const ABSOLUTE_MS = 12 * 3600_000;       // and after 12 hours in any case
const PRE_MS = 5 * 60_000;
const TOUCH_MS = 60_000;

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const hmac = (s) => crypto.createHmac("sha256", CFG.authSecret).update(String(s)).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");

// ---------- cookies ----------
function readCookie(req, name) {
  const raw = String(req.headers.cookie || "");
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) { try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return ""; } }
  }
  return "";
}
const cookie = (name, value, maxAgeSec) =>
  `${name}=${value || ""}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${value ? maxAgeSec : 0}`;
const LEGACY_CLEAR = "wc_admin=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0";

// ---------- password ----------
function passwordMatches(input) {
  if (!CFG.adminPassword) return false;
  const a = crypto.createHash("sha256").update(String(input || "")).digest();
  const b = crypto.createHash("sha256").update(CFG.adminPassword).digest();
  return crypto.timingSafeEqual(a, b);
}
const passwordFingerprint = () => hmac("pw:" + CFG.adminPassword).slice(0, 32);

// ---------- TOTP (RFC 6238: SHA-1, 6 digits, 30 s) ----------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Encode(buf) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of String(str).toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function hotp(key, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const code = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, "0");
}
// Returns the matching time step (±1 step for clock drift), or -1. Steps <= lastStep are rejected (no replay).
function verifyTotp(secretB32, code, lastStep = -1, now = Date.now()) {
  const c = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return -1;
  const key = base32Decode(secretB32);
  const step = Math.floor(now / 30_000);
  for (const s of [step - 1, step, step + 1]) {
    if (s <= lastStep) continue;
    const exp = hotp(key, s);
    if (crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(c))) return s;
  }
  return -1;
}

// 2FA secrets are encrypted at rest (AES-256-GCM) with a key derived from AUTH_SECRET.
const mfaKey = () => crypto.createHash("sha256").update("wc-mfa:" + CFG.authSecret).digest();
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", mfaKey(), iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}
function decrypt(b64) {
  const buf = Buffer.from(b64, "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", mfaKey(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

async function getMfa() { return L.getJSON("mfa"); }

function newRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const h = crypto.randomBytes(5).toString("hex");
    return h.slice(0, 5) + "-" + h.slice(5);
  });
}
const recoveryHash = (code) => hmac("rc:" + String(code).toLowerCase().replace(/[^a-f0-9]/g, ""));

// Checks a 6-digit app code or a one-time recovery code against the stored 2FA settings.
// On success it records the used step / burns the recovery code. Returns "totp", "recovery" or "".
async function checkSecondFactor(mfa, code) {
  const c = String(code || "").trim();
  if (/^\d{3}\s?\d{3}$/.test(c)) {
    let secret;
    try { secret = decrypt(mfa.enc); } catch { return ""; }
    const step = verifyTotp(secret, c, mfa.lastStep ?? -1);
    if (step < 0) return "";
    mfa.lastStep = step;
    await L.redis("SET", "mfa", JSON.stringify(mfa));
    return "totp";
  }
  if (/^[a-f0-9]{5}-?[a-f0-9]{5}$/i.test(c)) {
    const h = recoveryHash(c);
    const i = (mfa.recovery || []).indexOf(h);
    if (i < 0) return "";
    mfa.recovery.splice(i, 1);
    await L.redis("SET", "mfa", JSON.stringify(mfa));
    return "recovery";
  }
  return "";
}

// ---------- brute-force protection ----------
// Per-IP failure counter with progressive lockout: 5 failures → 1 min, then 2, 4, 8 … up to 60 min.
async function loginLock(req) {
  const ttl = Number(await L.redis("PTTL", "lock:ip:" + L.ipHash(req)));
  return ttl > 0 ? Math.ceil(ttl / 1000) : 0;
}

async function recordFailure(req, kind) {
  const ip = L.ipHash(req);
  const [n, , g] = await L.pipeline([
    ["INCR", "lf:" + ip], ["EXPIRE", "lf:" + ip, "86400", "NX"],
    ["INCR", "lf:global"], ["EXPIRE", "lf:global", "3600", "NX"]
  ]);
  if (n >= 5) {
    const ms = Math.min(60_000 * 2 ** (n - 5), 3600_000);
    await L.redis("SET", "lock:ip:" + ip, "1", "PX", String(ms));
  }
  const ctx = L.requestContext(req);
  if (n === 5 || n === 10 || n === 20) {
    await N.adminAlert({
      type: "login_failures", key: ip, throttleSec: 3600,
      subject: "Repeated failed admin sign-in attempts",
      lines: [`${n} failed ${kind} attempts from one address (hash ${ip}${ctx.country ? ", country " + ctx.country : ""}).`, "Sign-in from that address is temporarily blocked.", "If this wasn't you, consider changing ADMIN_PASSWORD in Vercel."]
    });
  }
  if (g === 20 || g === 100) {
    await N.adminAlert({
      type: "login_failures_global", key: "", throttleSec: 3 * 3600,
      subject: "Unusual number of failed admin sign-ins",
      lines: [`${g} failed sign-in attempts in the last hour across all addresses.`]
    });
  }
  // a small random delay slows down automated guessing
  await L.sleep(400 + Math.floor(Math.random() * 400));
}

async function clearFailures(req) { await L.redis("DEL", "lf:" + L.ipHash(req)); }

// ---------- sessions ----------
// stage "enroll": password checked, 2FA not set up yet — only the 2FA setup endpoints work.
// stage "full": password + 2FA verified.
async function createSession(req, stage, extraCookies = []) {
  const token = randomToken();
  const id = sha256(token);
  const ctx = L.requestContext(req);
  const now = Date.now();
  let dev = readCookie(req, DEVICE_COOKIE);
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(dev)) dev = "";
  const devKnown = dev ? Boolean(await L.redis("EXISTS", "dev:" + sha256(dev))) : false;
  if (!dev) dev = randomToken();

  const session = { createdAt: now, lastSeen: now, stage, pwfp: passwordFingerprint(), ip: ctx.ip, country: ctx.country, city: ctx.city, ua: ctx.ua };
  await L.pipeline([
    ["SET", "sess:" + id, JSON.stringify(session), "PX", String(ABSOLUTE_MS)],
    ["ZADD", "sessions", String(now + ABSOLUTE_MS), id],
    ["ZREMRANGEBYSCORE", "sessions", "-inf", String(now)],
    ["SET", "dev:" + sha256(dev), "1", "EX", String(400 * 86400)]
  ]);
  await clearFailures(req);

  // password rotation check: alert once when ADMIN_PASSWORD changed since the last sign-in
  const fp = passwordFingerprint();
  const prev = await L.redis("GETSET", "auth:pwfp", fp);
  if (prev && prev !== fp) {
    await L.audit(req, { id }, "auth.password_changed", "", null);
    await N.adminAlert({ type: "password_changed", key: "", throttleSec: 60, subject: "Admin password was changed", lines: ["The ADMIN_PASSWORD environment variable changed. All earlier sessions were signed out."] });
  }
  if (stage === "full" && !devKnown) {
    await N.adminAlert({
      type: "new_device", key: sha256(dev).slice(0, 12), throttleSec: 600,
      subject: "Admin sign-in from a new device",
      lines: [`Successful admin sign-in from a browser not seen before.`, `Location: ${[ctx.city, ctx.country].filter(Boolean).join(", ") || "unknown"}`, `Browser: ${ctx.ua || "unknown"}`, "", "If this wasn't you: change ADMIN_PASSWORD in Vercel (this signs out every session) and reset 2FA."]
    });
  }
  return {
    session: { ...session, id },
    cookies: [
      cookie(SESSION_COOKIE, token, ABSOLUTE_MS / 1000),
      cookie(DEVICE_COOKIE, dev, 400 * 86400),
      cookie(PRE_COOKIE, "", 0),
      LEGACY_CLEAR,
      ...extraCookies
    ]
  };
}

async function getSession(req) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const s = await L.getJSON("sess:" + id);
  if (!s) return null;
  const now = Date.now();
  if (now - s.lastSeen > IDLE_MS || now - s.createdAt > ABSOLUTE_MS || s.pwfp !== passwordFingerprint()) {
    await destroySession(id);
    return null;
  }
  if (now - s.lastSeen > TOUCH_MS) {
    s.lastSeen = now;
    await L.redis("SET", "sess:" + id, JSON.stringify(s), "PX", String(Math.max(1000, s.createdAt + ABSOLUTE_MS - now)));
  }
  return { ...s, id };
}

async function destroySession(id) { await L.pipeline([["DEL", "sess:" + id], ["ZREM", "sessions", id]]); }

async function listSessions() {
  const now = Date.now();
  const ids = (await L.redis("ZRANGE", "sessions", String(now), "+inf", "BYSCORE")) || [];
  const all = ids.length ? await L.mgetJSON(ids.map((i) => "sess:" + i)) : [];
  return ids.map((id, i) => all[i] && { ...all[i], id }).filter((s) => s && now - s.lastSeen <= IDLE_MS);
}

async function destroyAllSessions(exceptId) {
  const ids = (await L.redis("ZRANGE", "sessions", "0", "-1")) || [];
  const cmds = ids.filter((i) => i !== exceptId).flatMap((i) => [["DEL", "sess:" + i], ["ZREM", "sessions", i]]);
  if (cmds.length) await L.pipeline(cmds);
  return cmds.length / 2;
}

// Use at the top of every admin endpoint. Sends the error response and returns null when the
// request is not allowed. Checks: configuration, a valid full session, and same-origin for writes.
async function requireAdmin(req, res, { allowEnroll = false } = {}) {
  const setup = L.setupState();
  if (!setup.storage || !setup.password || !setup.secret) { L.send(res, 503, { error: "not_configured" }); return null; }
  if (!["GET", "HEAD"].includes(req.method) && !L.sameOrigin(req)) { L.send(res, 403, { error: "bad_origin" }); return null; }
  const s = await getSession(req);
  if (!s) { L.send(res, 401, { error: "unauthorized" }, { "Set-Cookie": cookie(SESSION_COOKIE, "", 0) }); return null; }
  if (s.stage !== "full" && !allowEnroll) { L.send(res, 403, { error: "mfa_setup_required" }); return null; }
  return s;
}

module.exports = {
  SESSION_COOKIE, PRE_COOKIE, PRE_MS, IDLE_MS, ABSOLUTE_MS,
  readCookie, cookie, sha256, randomToken, passwordMatches,
  base32Encode, base32Decode, hotp, verifyTotp, encrypt, decrypt, getMfa, newRecoveryCodes, recoveryHash, checkSecondFactor,
  loginLock, recordFailure, createSession, getSession, destroySession, listSessions, destroyAllSessions, requireAdmin
};
