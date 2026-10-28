// GET    /api/auth                         — signed in? which step? is everything set up?
// POST   /api/auth {action:"login", password}
// POST   /api/auth {action:"mfa", code}            second step: 6-digit app code or a recovery code
// POST   /api/auth {action:"mfa-begin", code?}     start (re)setting up 2FA; returns the secret once
// POST   /api/auth {action:"mfa-confirm", code}    finish 2FA setup; returns one-time recovery codes
// POST   /api/auth {action:"recovery-codes", code} replace the recovery codes
// POST   /api/auth {action:"logout-others"}        sign out every other session
// DELETE /api/auth                                 log out (deletes the session on the server)

const crypto = require("crypto");
const L = require("./_lib");
const A = require("./_auth");
const N = require("./_notify");

const GENERIC = { error: "invalid_credentials" };

module.exports = L.handler(async (req, res) => {
  const setup = L.setupState();
  const ready = setup.storage && setup.password && setup.secret;

  if (req.method === "GET") {
    if (!ready) return L.send(res, 200, { loggedIn: false, setup });
    const s = await A.getSession(req);
    const pre = A.readCookie(req, A.PRE_COOKIE);
    const pending = !s && pre ? Boolean(await L.redis("EXISTS", "pre:" + A.sha256(pre))) : false;
    return L.send(res, 200, { loggedIn: Boolean(s && s.stage === "full"), stage: s ? s.stage : pending ? "mfa" : "", setup });
  }

  if (req.method === "DELETE") {
    if (!L.sameOrigin(req)) return L.send(res, 403, { error: "bad_origin" });
    if (ready) {
      const s = await A.getSession(req);
      if (s) { await A.destroySession(s.id); await L.audit(req, s, "auth.logout", "", null); }
    }
    return L.send(res, 200, { ok: true }, { "Set-Cookie": [A.cookie(A.SESSION_COOKIE, "", 0), A.cookie(A.PRE_COOKIE, "", 0)] });
  }

  if (req.method !== "POST") return L.send(res, 405, { error: "method_not_allowed" }, { Allow: "GET, POST, DELETE" });
  if (!ready) return L.send(res, 503, { error: "not_configured", setup });
  if (!L.sameOrigin(req)) return L.send(res, 403, { error: "bad_origin" });

  const b = await L.readBody(req, 4000);
  const action = String(b.action || "login");

  // ----- step 1: password
  if (action === "login") {
    const wait = await A.loginLock(req);
    if (wait) return L.send(res, 429, { error: "too_many_attempts", retryAfter: wait }, { "Retry-After": String(wait) });
    if (typeof b.password !== "string" || b.password.length > 500 || !A.passwordMatches(b.password)) {
      await A.recordFailure(req, "password");
      await L.audit(req, null, "auth.login_failed", "", { step: "password" });
      return L.send(res, 401, GENERIC);
    }
    const mfa = await A.getMfa();
    if (mfa && mfa.enc) {
      const token = A.randomToken();
      await L.redis("SET", "pre:" + A.sha256(token), JSON.stringify({ at: Date.now(), tries: 0 }), "PX", String(A.PRE_MS));
      return L.send(res, 200, { ok: true, next: "mfa" }, { "Set-Cookie": A.cookie(A.PRE_COOKIE, token, A.PRE_MS / 1000) });
    }
    // 2FA not set up yet: a limited session that can only set it up
    const { session, cookies } = await A.createSession(req, "enroll");
    await L.audit(req, session, "auth.login", "", { step: "password", mfa: "not_set_up" });
    return L.send(res, 200, { ok: true, next: "mfa-setup" }, { "Set-Cookie": cookies });
  }

  // ----- step 2: 2FA code
  if (action === "mfa") {
    const wait = await A.loginLock(req);
    if (wait) return L.send(res, 429, { error: "too_many_attempts", retryAfter: wait }, { "Retry-After": String(wait) });
    const token = A.readCookie(req, A.PRE_COOKIE);
    const key = "pre:" + A.sha256(token || "-");
    const pre = token ? await L.getJSON(key) : null;
    const mfa = await A.getMfa();
    if (!pre || !mfa) return L.send(res, 401, { error: "mfa_expired" }, { "Set-Cookie": A.cookie(A.PRE_COOKIE, "", 0) });
    const used = await A.checkSecondFactor(mfa, b.code);
    if (!used) {
      pre.tries++;
      if (pre.tries >= 5) await L.redis("DEL", key);
      else await L.redis("SET", key, JSON.stringify(pre), "KEEPTTL");
      await A.recordFailure(req, "2FA code");
      await L.audit(req, null, "auth.login_failed", "", { step: "2fa" });
      return L.send(res, 401, { error: "invalid_code" });
    }
    await L.redis("DEL", key);
    const { session, cookies } = await A.createSession(req, "full");
    await L.audit(req, session, "auth.login", "", { method: used });
    if (used === "recovery") {
      await N.adminAlert({ type: "recovery_used", key: "", throttleSec: 60, subject: "A 2FA recovery code was used", lines: [`An admin signed in with a one-time recovery code. ${mfa.recovery.length} codes left.`, "If this wasn't you, change ADMIN_PASSWORD in Vercel and set up 2FA again."] });
    }
    return L.send(res, 200, { ok: true, next: "app" }, { "Set-Cookie": cookies });
  }

  // ----- everything below needs a session
  const s = await A.requireAdmin(req, res, { allowEnroll: action === "mfa-begin" || action === "mfa-confirm" });
  if (!s) return;
  const mfa = await A.getMfa();

  if (action === "mfa-begin") {
    // re-setting 2FA while it is on needs a current code, so a hijacked session can't silently take it over
    if (mfa && mfa.enc && !(await A.checkSecondFactor(mfa, b.code))) return L.send(res, 401, { error: "invalid_code" });
    const secret = A.base32Encode(crypto.randomBytes(20));
    await L.redis("SET", "mfa:pending:" + s.id, A.encrypt(secret), "EX", "900");
    const uri = `otpauth://totp/${encodeURIComponent("WEB-CREATORS:Admin")}?secret=${secret}&issuer=WEB-CREATORS&algorithm=SHA1&digits=6&period=30`;
    return L.send(res, 200, { secret, uri });
  }

  if (action === "mfa-confirm") {
    const enc = await L.redis("GET", "mfa:pending:" + s.id);
    if (!enc) return L.send(res, 400, { error: "mfa_setup_expired" });
    const secret = A.decrypt(enc);
    const step = A.verifyTotp(secret, b.code);
    if (step < 0) return L.send(res, 401, { error: "invalid_code" });
    const codes = A.newRecoveryCodes();
    const wasOn = Boolean(mfa && mfa.enc);
    await L.pipeline([
      ["SET", "mfa", JSON.stringify({ enc: A.encrypt(secret), enabledAt: Date.now(), lastStep: step, recovery: codes.map(A.recoveryHash) })],
      ["DEL", "mfa:pending:" + s.id]
    ]);
    // new secret: sign out every other session, and replace this one (new token, full access)
    await A.destroyAllSessions(s.id);
    await A.destroySession(s.id);
    const { session, cookies } = await A.createSession(req, "full");
    await L.audit(req, session, wasOn ? "auth.mfa_reset" : "auth.mfa_enabled", "", null);
    await N.adminAlert({ type: "mfa_changed", key: "", throttleSec: 60, subject: wasOn ? "Two-factor authentication was reset" : "Two-factor authentication was turned on", lines: ["The admin 2FA authenticator was " + (wasOn ? "replaced" : "set up") + ". Other sessions were signed out.", "If this wasn't you, change ADMIN_PASSWORD in Vercel immediately."] });
    return L.send(res, 200, { ok: true, recoveryCodes: codes }, { "Set-Cookie": cookies });
  }

  if (action === "recovery-codes") {
    if (!mfa || !(await A.checkSecondFactor(mfa, b.code))) return L.send(res, 401, { error: "invalid_code" });
    const codes = A.newRecoveryCodes();
    mfa.recovery = codes.map(A.recoveryHash);
    await L.redis("SET", "mfa", JSON.stringify(mfa));
    await L.audit(req, s, "auth.recovery_codes_replaced", "", null);
    await N.adminAlert({ type: "mfa_changed", key: "rc", throttleSec: 60, subject: "2FA recovery codes were replaced", lines: ["New one-time recovery codes were generated; the old ones no longer work."] });
    return L.send(res, 200, { ok: true, recoveryCodes: codes });
  }

  if (action === "logout-others") {
    const n = await A.destroyAllSessions(s.id);
    await L.audit(req, s, "auth.logout_others", "", { sessions: n });
    return L.send(res, 200, { ok: true, signedOut: n });
  }

  return L.send(res, 400, { error: "unknown_action" });
});
