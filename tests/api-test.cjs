// End-to-end API tests against the real API handlers, with local stand-ins for Upstash Redis and Resend.
// Run from the repository root: node tests/api-test.cjs   (no network access or real credentials needed)
const ROOT = require("path").resolve(__dirname, "..");
Object.assign(process.env, {
  KV_REST_API_URL: "http://127.0.0.1:7301", KV_REST_API_TOKEN: "test-token",
  ADMIN_PASSWORD: "correct horse battery staple 42", AUTH_SECRET: "x".repeat(16) + "local-test-secret-value-123456",
  RESEND_API_KEY: "re_test_key", RESEND_API_URL: "http://127.0.0.1:7302", EMAIL_FROM: "WebCreators <orders@notify.example.com>",
  ADMIN_NOTIFICATION_EMAIL: "owner@example.com", SITE_URL: "https://www.webcreatorsuz.com", CRON_SECRET: "cron-test-secret"
});
const assert = require("assert");
const { redisServer, mailServer } = require("./mocks.cjs");
const { start } = require("./devserver.cjs");
const A = require(ROOT + "/api/_auth.js");
const L = require(ROOT + "/api/_lib.js");
const BASE = "http://127.0.0.1:7300", ORIGIN = BASE;
const results = [];
async function test(name, fn) { try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name + " — " + e.message]); } }

function jar() { const c = {}; return { header: () => Object.entries(c).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("; "), take(res) { for (const sc of res.headers.getSetCookie()) { const [kv] = sc.split(";"); const i = kv.indexOf("="); const k = kv.slice(0, i), v = kv.slice(i + 1); if (/Max-Age=0/.test(sc)) delete c[k]; else c[k] = v; } }, raw: c }; }
async function call(path, { method = "GET", body, jar: j, ip = "10.0.0.1", origin = ORIGIN, headers = {}, raw } = {}) {
  const h = { "x-test-ip": ip, ...headers };
  if (origin && method !== "GET") h.Origin = origin;
  if (body !== undefined && !raw) h["Content-Type"] = "application/json";
  if (j) h.Cookie = j.header();
  const res = await fetch(BASE + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  if (j) j.take(res);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
const order = (o = {}) => ({ name: "Aziz Karimov", phone: "+998 90 123 45 67", business: "Restaurant / cafe", businessKey: "restaurant", budget: "$300–500", budgetKey: "b2", message: "Need a menu website", language: "English", langCode: "en", page: "/", company: "", elapsed: 9000, ...o });
const totpNow = (secret, offset = 0) => A.hotp(A.base32Decode(secret), Math.floor(Date.now() / 30000) + offset);

(async () => {
  const rs = await redisServer(7301), ms = await mailServer(7302); await start(ROOT, 7300);
  const mail = ms.state;
  let id1, owner = jar(), secret, recovery;

  await test("Vercel-style parsed bodies: malformed JSON → 400, parsed object accepted, arrays refused", async () => {
    const mk = (body, type = "application/json") => { const r = { headers: { "content-type": type } }; Object.defineProperty(r, "body", { get() { if (body instanceof Error) throw body; return body; } }); return r; };
    await assert.rejects(L.readBody(mk(new Error("Invalid JSON"))), (e) => e.status === 400);
    assert.deepEqual(await L.readBody(mk({ a: 1 })), { a: 1 });
    await assert.rejects(L.readBody(mk([1])), (e) => e.status === 400);
    await assert.rejects(L.readBody(mk("x", "text/plain")), (e) => e.status === 415);
  });
  await test("security headers on public page", async () => {
    const r = await call("/");
    for (const h of ["strict-transport-security", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"]) assert(r.headers.get(h), "missing " + h);
  });
  await test("admin page: strict CSP (no inline scripts), no-store, noindex", async () => {
    const r = await call("/admin/");
    assert.match(r.headers.get("content-security-policy"), /script-src 'self';/);
    assert.match(r.headers.get("cache-control"), /no-store/);
    assert.match(r.headers.get("x-robots-tag"), /noindex/);
    assert(!/<script>/.test(r.data), "inline script left in admin page");
  });
  await test("unauthenticated: admin APIs refuse", async () => {
    for (const p of ["/api/orders", "/api/orders?view=summary", "/api/order?id=abcdef123", "/api/admin?section=security", "/api/admin?section=backup", "/api/admin?section=audit"]) assert.equal((await call(p)).status, 401, p);
    assert.equal((await call("/api/order?id=abcdef123", { method: "DELETE" })).status, 401);
    assert.equal((await call("/api/order?id=abcdef123", { method: "PATCH", body: { status: "done" } })).status, 401);
    assert.equal((await call("/api/order?id=abcdef123", { method: "POST", body: { action: "notify" } })).status, 401);
    assert.equal((await call("/api/cron")).status, 401);
    assert.equal((await call("/api/cron", { headers: { Authorization: "Bearer wrong" } })).status, 401);
  });
  await test("forged / legacy cookies are rejected", async () => {
    const fake = { header: () => "__Host-wc_admin=" + "A".repeat(43) + "; wc_admin=9999999999999.abc", take() {} };
    assert.equal((await call("/api/orders", { jar: fake })).status, 401);
  });
  await test("auth status endpoint reveals no secrets", async () => {
    const r = await call("/api/auth");
    assert.deepEqual(Object.keys(r.data).sort(), ["loggedIn", "setup", "stage"]);
    assert(!JSON.stringify(r.data).includes(process.env.ADMIN_PASSWORD));
  });

  // ---- orders
  await test("valid order is saved once, numbered, and e-mailed", async () => {
    const r = await call("/api/orders", { method: "POST", body: order({ requestId: "req-aaaaaaaa1" }) });
    assert.equal(r.status, 201); assert(r.data.id); assert.match(r.data.number, /^WC-\d{4}$/);
    id1 = r.data.id;
    assert.equal(mail.sent.length, 1);
    const m = mail.sent[0];
    assert.equal(m.subject, `[WebCreators] New Client Order — Order #${r.data.number}`);
    for (const s of ["NEW CLIENT ORDER RECEIVED", "Order ID: " + r.data.number, "Client name: Aziz Karimov", "Phone or Telegram: +998 90 123 45 67", "Service requested: Restaurant / cafe", "Project description: Need a menu website", "Estimated budget: $300–500", "Preferred language: English", "Order status: New", "ADMIN ACTION:", "https://www.webcreatorsuz.com/admin/#order=" + id1]) assert(m.text.includes(s), "email missing: " + s);
    assert.deepEqual(m.to, ["owner@example.com"]);
    assert(!/re_test_key|test-token|correct horse/.test(JSON.stringify(m)), "secret in email");
    assert.equal(m.key, `wc-order-${id1}-v0`);
  });
  await test("retried submission (same requestId) does not create a duplicate order or e-mail", async () => {
    const r = await call("/api/orders", { method: "POST", body: order({ requestId: "req-aaaaaaaa1" }) });
    assert.equal(r.status, 200); assert.equal(r.data.id, id1); assert.equal(r.data.duplicate, true);
    assert.equal(await L.redis("ZCARD", "orders"), 1); assert.equal(mail.sent.length, 1);
  });
  await test("same content re-sent within 10 min is de-duplicated", async () => {
    const r = await call("/api/orders", { method: "POST", body: order({ requestId: "req-bbbbbbbb2" }) });
    assert.equal(r.data.id, id1); assert.equal(await L.redis("ZCARD", "orders"), 1);
  });
  await test("spam traps: honeypot and instant submissions are not saved", async () => {
    assert.equal((await call("/api/orders", { method: "POST", body: order({ company: "ACME", message: "x1" }), ip: "10.0.0.9" })).status, 201);
    assert.equal((await call("/api/orders", { method: "POST", body: order({ elapsed: 300, message: "x2" }), ip: "10.0.0.9" })).status, 201);
    assert.equal(await L.redis("ZCARD", "orders"), 1);
  });
  await test("validation: bad name/phone, wrong content type, oversize body, bad JSON, foreign origin", async () => {
    assert.equal((await call("/api/orders", { method: "POST", body: order({ name: "A", message: "v1" }), ip: "10.0.1.1" })).data.error, "invalid_name");
    assert.equal((await call("/api/orders", { method: "POST", body: order({ phone: "12<script>", message: "v2" }), ip: "10.0.1.1" })).data.error, "invalid_phone");
    assert.equal((await call("/api/orders", { method: "POST", raw: "name=x", headers: { "Content-Type": "application/x-www-form-urlencoded" }, ip: "10.0.1.1" })).status, 415);
    assert.equal((await call("/api/orders", { method: "POST", body: order({ message: "x".repeat(20000) }), ip: "10.0.1.1" })).status, 413);
    assert.equal((await call("/api/orders", { method: "POST", raw: "{bad", headers: { "Content-Type": "application/json" }, ip: "10.0.1.1" })).status, 400);
    assert.equal((await call("/api/orders", { method: "POST", body: order({ message: "v3" }), origin: "https://evil.example", ip: "10.0.1.1" })).status, 403);
  });
  await test("injection payloads are stored as plain text, field lengths capped, unknown keys rejected", async () => {
    const r = await call("/api/orders", { method: "POST", body: order({ name: '<img src=x onerror=alert(1)>"\'', phone: "+998 91 000 00 01", message: "'; DROP TABLE orders; -- " + "m".repeat(3000), businessKey: "__proto__", budgetKey: "evil", id: "hacked", status: "done", number: 1 }), ip: "10.0.2.2" });
    assert.equal(r.status, 201);
    const o = await L.getOrder(r.data.id);
    assert.equal(o.name, '<img src=x onerror=alert(1)>"\''.slice(0, 80));
    assert.equal(o.message.length, 2000); assert.equal(o.businessKey, "other"); assert.equal(o.budgetKey, "");
    assert.equal(o.status, "new"); assert.notEqual(o.id, "hacked"); assert.notEqual(o.number, 1);
  });
  await test("e-commerce business type is kept (was mapped to 'other' before)", async () => {
    const r = await call("/api/orders", { method: "POST", body: order({ businessKey: "commerce", business: "E-commerce", phone: "+998 91 000 00 02", message: "shop" }), ip: "10.0.2.3" });
    assert.equal((await L.getOrder(r.data.id)).businessKey, "commerce");
  });
  await test("order form rate limit: 6th order from one address in 10 min is refused", async () => {
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await call("/api/orders", { method: "POST", body: order({ phone: "+998 93 000 00 1" + i, message: "rl " + i }), ip: "10.0.3.3" })).status);
    assert.deepEqual(codes, [201, 201, 201, 201, 201, 429]);
  });

  // ---- sign-in
  await test("wrong password: generic error", async () => {
    const r = await call("/api/auth", { method: "POST", body: { action: "login", password: "nope" }, ip: "10.9.9.1" });
    assert.equal(r.status, 401); assert.equal(r.data.error, "invalid_credentials");
  });
  await test("brute force: progressive lockout after 5 failures, even for the right password", async () => {
    for (let i = 0; i < 4; i++) await call("/api/auth", { method: "POST", body: { password: "bad" + i }, ip: "10.9.9.2" });
    const fifth = await call("/api/auth", { method: "POST", body: { password: "bad5" }, ip: "10.9.9.2" });
    assert.equal(fifth.status, 401);
    const locked = await call("/api/auth", { method: "POST", body: { password: process.env.ADMIN_PASSWORD }, ip: "10.9.9.2" });
    assert.equal(locked.status, 429); assert(locked.data.retryAfter > 0 && locked.data.retryAfter <= 60);
    const other = await call("/api/auth", { method: "POST", body: { password: "x" }, ip: "10.9.9.3" });
    assert.equal(other.status, 401, "other addresses are not locked out");
    const alerts = (await L.redis("LRANGE", "alerts", "0", "-1")).map(JSON.parse);
    assert(alerts.some((a) => a.type === "login_failures"), "no failed-login alert");
  });
  await test("login from another site is refused (CSRF)", async () => {
    assert.equal((await call("/api/auth", { method: "POST", body: { password: process.env.ADMIN_PASSWORD }, origin: "https://ai.webcreatorsuz.com", ip: "10.9.9.4" })).status, 403);
  });
  await test("first sign-in requires setting up 2FA; nothing else is accessible until then", async () => {
    const r = await call("/api/auth", { method: "POST", body: { action: "login", password: process.env.ADMIN_PASSWORD }, jar: owner });
    assert.equal(r.data.next, "mfa-setup");
    const sc = r.headers.getSetCookie().join("\n");
    assert.match(sc, /__Host-wc_admin=[^;]+; Path=\/; HttpOnly; Secure; SameSite=Strict/);
    assert.equal((await call("/api/orders", { jar: owner })).status, 403);
    assert.equal((await call("/api/admin?section=backup", { jar: owner })).status, 403);
    const b = await call("/api/auth", { method: "POST", body: { action: "mfa-begin" }, jar: owner });
    secret = b.data.secret; assert.match(b.data.uri, /^otpauth:\/\/totp\//);
    assert.equal((await call("/api/auth", { method: "POST", body: { action: "mfa-confirm", code: "000000" }, jar: owner })).status, 401);
    const before = owner.raw["__Host-wc_admin"];
    const c = await call("/api/auth", { method: "POST", body: { action: "mfa-confirm", code: totpNow(secret) }, jar: owner });
    assert.equal(c.status, 200); recovery = c.data.recoveryCodes; assert.equal(recovery.length, 10);
    assert.notEqual(owner.raw["__Host-wc_admin"], before, "session not regenerated");
    assert.equal((await call("/api/orders", { jar: owner })).status, 200);
    const stored = await L.redis("GET", "mfa");
    assert(!stored.includes(secret) && !stored.includes(recovery[0]), "2FA secret/codes stored in plain text");
  });
  let s2 = jar();
  await test("sign-in with password + authenticator code", async () => {
    const r = await call("/api/auth", { method: "POST", body: { action: "login", password: process.env.ADMIN_PASSWORD }, jar: s2, ip: "10.5.5.5" });
    assert.equal(r.data.next, "mfa"); assert.equal((await call("/api/orders", { jar: s2, ip: "10.5.5.5" })).status, 401);
    assert.equal((await call("/api/auth", { method: "POST", body: { action: "mfa", code: "123456" }, jar: s2, ip: "10.5.5.5" })).status, 401);
    // the code used at enrolment can't be replayed
    const replay = await call("/api/auth", { method: "POST", body: { action: "mfa", code: totpNow(secret) }, jar: s2, ip: "10.5.5.5" });
    const ok = replay.status === 200 ? replay : await call("/api/auth", { method: "POST", body: { action: "mfa", code: totpNow(secret, 1) }, jar: s2, ip: "10.5.5.5" });
    assert.equal(ok.status, 200);
    assert.equal((await call("/api/orders", { jar: s2, ip: "10.5.5.5" })).status, 200);
  });
  await test("TOTP: a used code can't be replayed; codes from other time windows fail", async () => {
    const step = Math.floor(Date.now() / 30000), code = A.hotp(A.base32Decode(secret), step);
    assert.equal(A.verifyTotp(secret, code, -1), step);
    assert.equal(A.verifyTotp(secret, code, step), -1, "replay accepted");
    assert.equal(A.verifyTotp(secret, A.hotp(A.base32Decode(secret), step - 3), -1), -1, "old code accepted");
    // RFC 6238 test vector (SHA-1, T=59 s → 94287082, 8 digits → last 6: 287082)
    assert.equal(A.hotp(Buffer.from("12345678901234567890"), 1), "287082");
  });
  await test("one-time recovery code works once", async () => {
    const j = jar();
    await call("/api/auth", { method: "POST", body: { password: process.env.ADMIN_PASSWORD }, jar: j, ip: "10.6.6.6" });
    assert.equal((await call("/api/auth", { method: "POST", body: { action: "mfa", code: recovery[0] }, jar: j, ip: "10.6.6.6" })).status, 200);
    const k = jar();
    await call("/api/auth", { method: "POST", body: { password: process.env.ADMIN_PASSWORD }, jar: k, ip: "10.6.6.7" });
    assert.equal((await call("/api/auth", { method: "POST", body: { action: "mfa", code: recovery[0] }, jar: k, ip: "10.6.6.7" })).status, 401);
    await call("/api/auth", { method: "DELETE", jar: j, ip: "10.6.6.6" });
  });
  await test("logout invalidates the session on the server (old cookie stops working)", async () => {
    const stolen = { header: () => "__Host-wc_admin=" + s2.raw["__Host-wc_admin"], take() {} };
    assert.equal((await call("/api/orders", { jar: stolen })).status, 200);
    await call("/api/auth", { method: "DELETE", jar: s2 });
    assert.equal((await call("/api/orders", { jar: stolen })).status, 401);
  });
  await test("idle timeout ends the session", async () => {
    const j = jar();
    await call("/api/auth", { method: "POST", body: { password: process.env.ADMIN_PASSWORD }, jar: j, ip: "10.7.7.7" });
    await call("/api/auth", { method: "POST", body: { action: "mfa", code: recovery[1] }, jar: j, ip: "10.7.7.7" });
    const key = "sess:" + A.sha256(j.raw["__Host-wc_admin"]);
    const s = JSON.parse(await L.redis("GET", key)); s.lastSeen -= 61 * 60000; await L.redis("SET", key, JSON.stringify(s), "PX", "600000");
    assert.equal((await call("/api/orders", { jar: j, ip: "10.7.7.7" })).status, 401);
  });
  await test("admin writes from another origin are refused (CSRF)", async () => {
    assert.equal((await call("/api/order?id=" + id1, { method: "PATCH", body: { status: "done" }, jar: owner, origin: "https://ai.webcreatorsuz.com" })).status, 403);
    assert.equal((await call("/api/order?id=" + id1, { method: "DELETE", jar: owner, origin: "https://evil.example" })).status, 403);
    assert.equal((await call("/api/order?id=" + id1, { method: "PATCH", raw: "status=done", headers: { "Content-Type": "text/plain" }, jar: owner })).status, 415);
  });

  // ---- admin order management
  await test("status workflow incl. 'In discussion', validation, protected fields, audit", async () => {
    assert.equal((await call("/api/order?id=" + id1, { method: "PATCH", body: { status: "hacked" }, jar: owner })).status, 400);
    assert.equal((await call("/api/order?id=" + id1, { method: "PATCH", body: { price: -5 }, jar: owner })).status, 400);
    const r = await call("/api/order?id=" + id1, { method: "PATCH", body: { status: "discussion", notes: "Call back Monday", id: "zzz", number: 999, name: "Changed", createdAt: 1 }, jar: owner });
    assert.equal(r.status, 200); assert.equal(r.data.order.status, "discussion");
    const o = await L.getOrder(id1);
    assert.equal(o.id, id1); assert.equal(o.name, "Aziz Karimov"); assert.notEqual(o.number, 999); assert.notEqual(o.createdAt, 1);
    const d = await call("/api/order?id=" + id1, { jar: owner });
    assert(d.data.history.some((h) => h.action === "order.updated" && h.details.status.to === "discussion"));
    assert.equal((await call("/api/order?id=../../etc", { jar: owner })).status, 400);
    assert.equal((await call("/api/order?id=zzzzzzzzzz", { jar: owner })).status, 404);
  });
  await test("search, filters and pagination", async () => {
    let r = await call("/api/orders?q=aziz&pageSize=5", { jar: owner });
    assert.equal(r.status, 200); assert(r.data.total >= 1); assert(r.data.orders.every((o) => /aziz/i.test(o.name)));
    r = await call("/api/orders?status=discussion", { jar: owner }); assert.equal(r.data.total, 1);
    r = await call("/api/orders?biz=commerce", { jar: owner }); assert.equal(r.data.total, 1);
    r = await call("/api/orders?pageSize=5&page=2", { jar: owner }); assert.equal(r.data.page, 2); assert(r.data.orders.length >= 1);
    const today = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
    r = await call(`/api/orders?from=${today}&to=${today}`, { jar: owner }); assert.equal(r.data.total, r.data.statusCounts.all);
    r = await call("/api/orders?from=2000-01-01&to=2000-01-02", { jar: owner }); assert.equal(r.data.total, 0);
    r = await call("/api/orders?q=" + encodeURIComponent((await L.getOrder(id1)).number.toString().padStart(4, "0")), { jar: owner }); assert(r.data.total >= 1);
    assert(!("notes" in r.data.orders[0]), "list leaks internal notes");
  });

  // ---- notification failures and retries
  let idF;
  await test("e-mail outage: order is still saved and the client sees success; failure is recorded", async () => {
    mail.mode = "fail500"; const before = mail.calls;
    const r = await call("/api/orders", { method: "POST", body: order({ phone: "+998 94 555 55 55", message: "outage", requestId: "req-outage-1" }), ip: "10.8.8.8" });
    assert.equal(r.status, 201); idF = r.data.id;
    assert(await L.getOrder(idF), "order not saved");
    const n = JSON.parse(await L.redis("GET", "notify:" + idF));
    assert.equal(n.email.status, "failed"); assert.equal(n.email.attempts, 2); assert.equal(mail.calls - before, 2);
    assert.match(n.email.lastError, /HTTP 500/); assert(n.email.nextRetryAt > Date.now());
    assert(!/re_test_key/.test(n.email.lastError));
    assert(await L.redis("ZRANGE", "notify:due", "0", "-1").then((x) => x.includes(idF)));
    const s = await call("/api/orders?view=summary", { jar: owner }); assert.equal(s.data.notifyFailed, 1);
    const f = await call("/api/orders?notify=failed", { jar: owner }); assert.equal(f.data.total, 1);
  });
  await test("non-transient error (e.g. unverified domain) is not hammered", async () => {
    mail.mode = "fail422"; const before = mail.calls;
    const r = await call("/api/orders", { method: "POST", body: order({ phone: "+998 94 555 55 56", message: "422" }), ip: "10.8.8.9" });
    assert.equal(r.status, 201); assert.equal(mail.calls - before, 1);
    assert.match(JSON.parse(await L.redis("GET", "notify:" + r.data.id)).email.lastError, /validation_error/);
  });
  await test("manual retry delivers once; a second retry sends nothing; 'send again' sends exactly one more", async () => {
    mail.mode = "ok"; const sent0 = mail.sent.length;
    let r = await call("/api/order?id=" + idF, { method: "POST", body: { action: "notify" }, jar: owner });
    assert.equal(r.status, 200); assert.equal(r.data.notify.email.status, "sent"); assert.equal(mail.sent.length, sent0 + 1);
    await new Promise((x) => setTimeout(x, 20500));
    r = await call("/api/order?id=" + idF, { method: "POST", body: { action: "notify" }, jar: owner });
    assert.equal(mail.sent.length, sent0 + 1, "retry of an already-sent notification sent another e-mail");
    await new Promise((x) => setTimeout(x, 20500));
    r = await call("/api/order?id=" + idF, { method: "POST", body: { action: "notify", force: true }, jar: owner });
    assert.equal(mail.sent.length, sent0 + 2); assert.equal(mail.sent.at(-1).key, `wc-order-${idF}-v1`);
    assert.equal((await call("/api/order?id=" + idF, { method: "POST", body: { action: "notify", force: true }, jar: owner })).status, 429, "no throttle on resend");
    const d = await call("/api/order?id=" + idF, { jar: owner });
    assert(d.data.history.some((h) => h.action === "order.notify_retried") && d.data.history.some((h) => h.action === "order.notify_resent"));
  });
  await test("provider idempotency key prevents a duplicate after a lost response", async () => {
    const sent0 = mail.sent.length;
    const o = await L.getOrder(idF);
    const N = require(ROOT + "/api/_notify.js");
    const r1 = await N.sendEmail({ subject: "x", text: "x", html: "x", idempotencyKey: "wc-order-test-v0" });
    const r2 = await N.sendEmail({ subject: "x", text: "x", html: "x", idempotencyKey: "wc-order-test-v0" });
    assert.equal(r1.id, r2.id); assert.equal(mail.sent.length, sent0 + 1);
  });
  await test("scheduled retry job delivers due notifications", async () => {
    mail.mode = "fail500";
    const r = await call("/api/orders", { method: "POST", body: order({ phone: "+998 94 555 55 57", message: "cron" }), ip: "10.8.8.10" });
    mail.mode = "ok";
    const n = JSON.parse(await L.redis("GET", "notify:" + r.data.id)); n.email.nextRetryAt = Date.now() - 1000;
    await L.pipeline([["SET", "notify:" + r.data.id, JSON.stringify(n)], ["ZADD", "notify:due", String(Date.now() - 1000), r.data.id]]);
    const c = await call("/api/cron", { headers: { Authorization: "Bearer cron-test-secret" } });
    assert.equal(c.status, 200); assert(c.data.retried >= 1);
    assert.equal(JSON.parse(await L.redis("GET", "notify:" + r.data.id)).email.status, "sent");
  });

  // ---- admin tools
  await test("security overview, audit log, backup and test e-mail", async () => {
    const s = await call("/api/admin?section=security", { jar: owner });
    assert.equal(s.data.mfa.enabled, true); assert.equal(s.data.email.configured, true); assert.match(s.data.email.to[0], /^o\*+r@example\.com$/);
    const a = await call("/api/admin?section=audit", { jar: owner });
    const actions = a.data.entries.map((e) => e.action);
    for (const x of ["auth.login", "auth.login_failed", "auth.mfa_enabled", "auth.logout", "order.created", "order.updated"]) assert(actions.includes(x), "audit missing " + x);
    const b = await call("/api/admin?section=backup", { jar: owner });
    assert.equal(b.status, 200); assert.match(b.headers.get("content-disposition"), /attachment/); assert(b.data.orders.length >= 5);
    const sent0 = mail.sent.length;
    const t = await call("/api/admin", { method: "POST", body: { action: "test-email" }, jar: owner });
    assert.equal(t.data.ok, true); assert.equal(mail.sent.length, sent0 + 1);
  });
  await test("no passwords, codes, tokens or raw IPs in the audit log, alerts or sessions", async () => {
    const dump = JSON.stringify([...rs.db.entries()].filter(([k]) => /^(audit|alerts|sess:)/.test(k)).map(([, e]) => e.v instanceof Map ? [...e.v] : e.v));
    for (const s of [process.env.ADMIN_PASSWORD, secret, recovery[2], "10.0.0.1", "10.9.9.2", owner.raw["__Host-wc_admin"], "re_test_key"]) assert(!dump.includes(s), "found secret-like value: " + String(s).slice(0, 6));
  });
  await test("changing ADMIN_PASSWORD signs out every session and raises an alert", async () => {
    L.CFG.adminPassword = "a brand new password 2026";
    assert.equal((await call("/api/orders", { jar: owner })).status, 401);
    const j = jar();
    await call("/api/auth", { method: "POST", body: { password: "a brand new password 2026" }, jar: j, ip: "10.4.4.4" });
    await call("/api/auth", { method: "POST", body: { action: "mfa", code: recovery[3] }, jar: j, ip: "10.4.4.4" });
    assert.equal((await call("/api/orders", { jar: j, ip: "10.4.4.4" })).status, 200);
    const alerts = (await L.redis("LRANGE", "alerts", "0", "-1")).map(JSON.parse);
    assert(alerts.some((a) => a.type === "password_changed"));
    L.CFG.adminPassword = process.env.ADMIN_PASSWORD;
  });
  await test("delete is admin-only and audited", async () => {
    const j = jar();
    await call("/api/auth", { method: "POST", body: { password: process.env.ADMIN_PASSWORD }, jar: j, ip: "10.4.4.5" });
    await call("/api/auth", { method: "POST", body: { action: "mfa", code: recovery[4] }, jar: j, ip: "10.4.4.5" });
    const r = await call("/api/order?id=" + idF, { method: "DELETE", jar: j, ip: "10.4.4.5" });
    assert.equal(r.status, 200); assert.equal(await L.getOrder(idF), null);
    const a = await call("/api/admin?section=audit", { jar: j, ip: "10.4.4.5" });
    assert(a.data.entries.some((e) => e.action === "order.deleted"));
  });

  for (const [s, n] of results) console.log(s.padEnd(5), n);
  console.log(`\n${results.filter((r) => r[0] === "PASS").length}/${results.length} passed`);
  process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
})();
