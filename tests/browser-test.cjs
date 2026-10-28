// Browser tests (Playwright + Chromium). Start `node tests/serve-local.cjs` first, then run `node tests/browser-test.cjs`.
// Screenshots go to tests/shots/ (git-ignored).
const { chromium } = require("playwright");
const path = require("path");
const SHOTS = path.join(__dirname, "shots");
require("fs").mkdirSync(SHOTS, { recursive: true });
const crypto = require("crypto");
const BASE = "http://localhost:7310";
const results = [];
const ok = (c, n) => results.push([c ? "PASS" : "FAIL", n]);
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function b32d(s) { let bits = 0, v = 0; const o = []; for (const ch of s.replace(/[^A-Z2-7]/g, "")) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { o.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(o); }
function totp(secret, off = 0) { const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + off)); const h = crypto.createHmac("sha1", b32d(secret)).update(m).digest(); const o = h[19] & 15; return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0"); }
const ctl = (p) => fetch("http://127.0.0.1:7313" + p).then((r) => r.json());
function watch(page, tag) {
  const issues = [];
  page.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/fonts\.(googleapis|gstatic)|ERR_|Failed to load resource/.test(t)) issues.push(tag + ": " + t); if (/Content Security Policy|Refused to/.test(t)) issues.push(tag + " CSP: " + t); });
  page.on("pageerror", (e) => issues.push(tag + " JS error: " + e.message));
  page.on("dialog", (d) => { issues.push(tag + " DIALOG (possible XSS): " + d.message()); d.dismiss(); });
  return issues;
}
(async () => {
  const browser = await chromium.launch();
  await browser.newContext().then((c) => c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()));

  // ---- public site, desktop + mobile
  for (const [tag, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const page = await ctx.newPage();
    const issues = watch(page, "site-" + tag);
    await page.goto(BASE + "/?lang=en", { waitUntil: "load" });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/site-${tag}.png` });
    const hasHero = await page.locator("h1").first().isVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(hasHero && !overflow, `public site renders on ${tag} (no horizontal overflow)`);
    // language switch still works
    await page.goto(BASE + "/?lang=ru", { waitUntil: "load" });
    ok((await page.evaluate(() => document.documentElement.lang)) === "ru", `language switching works on ${tag}`);
    await page.goto(BASE + "/?lang=en", { waitUntil: "load" });
    if (tag === "desktop") {
      // real form submission through the UI
      await page.locator("#contact").scrollIntoViewIfNeeded();
      await page.waitForTimeout(1600);
      await page.fill("#f-name", "Browser Test Client");
      await page.fill("#f-phone", "+998 90 777 66 55");
      await page.selectOption("#f-biz", "commerce");
      await page.selectOption("#f-budget", "b4");
      await page.fill("#f-msg", "Online store with delivery <b>bold?</b>");
      await page.click("#f-submit");
      await page.waitForSelector("#form-result.show", { timeout: 15000 });
      const okText = await page.locator("#form-result h3").innerText();
      const mail = await ctl("/");
      const m = mail.sent.find((x) => /Browser Test Client/.test(x.text));
      ok(/thank|received|sent/i.test(okText) && m, "form submission shows success and e-mails the admin (" + okText + ")");
      ok(m && m.subject.startsWith("[WebCreators] New Client Order — Order #WC-") && m.text.includes("Online store with delivery <b>bold?</b>") && m.html.includes("&lt;b&gt;bold?&lt;/b&gt;"), "e-mail has order details; HTML part escapes client text");
      await page.locator("#form-result").screenshot({ path: SHOTS + "/site-form-success.png" });
      // XSS attempt through the form, to check the admin later
      await page.click("#f-again");
      await page.waitForTimeout(1600);
      await page.fill("#f-name", '<img src=x onerror=alert("xss")>');
      await page.fill("#f-phone", "+998 90 777 66 56");
      await page.selectOption("#f-biz", "restaurant");
      await page.fill("#f-msg", '<script>alert("xss")</script>');
      await page.click("#f-submit");
      await page.waitForSelector("#form-result.show", { timeout: 15000 });
    }
    ok(issues.length === 0, `no CSP violations or JS errors on public site (${tag})` + (issues.length ? ": " + issues.join(" | ") : ""));
    await ctx.close();
  }

  // ---- admin
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const issues = watch(page, "admin");
  await page.goto(BASE + "/admin/", { waitUntil: "load" });
  await page.waitForSelector("#login:not([hidden])");
  await page.fill("#pw", "wrong password");
  await page.click("#login-btn");
  await page.waitForFunction(() => document.querySelector("#login-err").textContent.length > 0);
  ok((await page.locator("#login-err").innerText()).includes("Incorrect"), "wrong password shows a generic message");
  await page.fill("#pw", "correct horse battery staple 42");
  await page.click("#login-btn");
  await page.waitForSelector("#enroll:not([hidden])");
  await page.waitForSelector("#enroll-qr svg");
  await page.screenshot({ path: SHOTS + "/admin-2fa-setup.png" });
  const secret = (await page.locator("#enroll-secret").innerText()).replace(/\s/g, "");
  ok(secret.length >= 32, "2FA setup shows QR code and key");
  await page.fill("#enroll-code", totp(secret));
  await page.click("#enroll-btn");
  await page.waitForSelector("#enroll-step2:not([hidden])");
  const codes = await page.locator("#enroll-codes li").allInnerTexts();
  ok(codes.length === 10, "recovery codes shown once after setup");
  await page.screenshot({ path: SHOTS + "/admin-recovery-codes.png" });
  ok(await page.locator("#codes-done").isDisabled(), "must confirm codes were saved before continuing");
  await page.check("#codes-saved");
  await page.click("#codes-done");
  await page.waitForSelector("#app:not([hidden]) .kpis");
  await page.waitForTimeout(700);
  await page.screenshot({ path: SHOTS + "/admin-overview.png" });
  const kpis = await page.locator(".kpi-label").allInnerTexts();
  ok(["Total orders", "New", "In progress", "Completed", "Cancelled", "Notification failures"].every((k) => kpis.includes(k)), "overview shows total/new/in progress/completed/cancelled/notification KPIs");
  const cookies = await ctx.cookies();
  const sc = cookies.find((c) => c.name === "__Host-wc_admin");
  ok(sc && sc.httpOnly && sc.secure && sc.sameSite === "Strict", "session cookie is HttpOnly, Secure, SameSite=Strict");
  ok(!(await page.evaluate(() => JSON.stringify(localStorage) + document.cookie)).match(/wc_admin|token/i), "no auth token readable from JavaScript/localStorage");

  // orders list
  await page.click('#side-nav [data-view="orders"]');
  await page.waitForSelector("table tbody tr");
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOTS + "/admin-orders.png" });
  const rows = await page.locator("table tbody tr").count();
  ok(rows >= 3, `orders list shows saved orders (${rows})`);
  ok((await page.locator("tbody").innerText()).includes('<img src=x onerror=alert("xss")>'), "malicious name shown as harmless text");
  // filters
  await page.click('[data-status-filter="contacted"]'); await page.waitForTimeout(500);
  ok((await page.locator("table tbody tr").count()) === 1, "status filter works");
  await page.click("#f-clear"); await page.waitForTimeout(500);
  await page.fill("#search", "Browser Test"); await page.waitForTimeout(800);
  ok((await page.locator("table tbody tr").count()) === 1, "search works");
  // drawer of new order
  await page.locator("table tbody tr").first().click();
  await page.waitForSelector(".drawer.open .notify-box");
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOTS + "/admin-order-drawer.png" });
  ok((await page.locator(".drawer .notify-box").innerText()).includes("Sent"), "order detail shows e-mail delivery status");
  await page.click('#dr-status [data-s="discussion"]');
  await page.fill("#dr-notes", "Team note: send concept Friday");
  await page.click("#dr-save");
  await page.waitForTimeout(800);
  await page.fill("#search", ""); await page.waitForTimeout(800);
  // legacy order
  await page.fill("#search", "Dilnoza"); await page.waitForTimeout(800);
  await page.locator("table tbody tr").first().click();
  await page.waitForSelector(".drawer.open .notify-box");
  ok((await page.locator(".drawer .notify-box").innerText()).includes("before delivery tracking"), "older orders open fine and are labelled");
  await page.click("#dr-close");
  await page.fill("#search", ""); await page.waitForTimeout(600);

  // notification failure + retry from the admin
  await ctl("/mode?m=fail500");
  await page.evaluate(() => fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Outage Client", phone: "+998 90 111 00 99", business: "Hotel", businessKey: "hotel", budget: "—", message: "—", elapsed: 5000 }) }));
  await ctl("/mode?m=ok");
  await page.click("#refresh"); await page.waitForTimeout(1200);
  ok(await page.locator(".banner").isVisible(), "failure banner appears when a notification fails");
  await page.screenshot({ path: SHOTS + "/admin-failure-banner.png" });
  await page.click(".banner button"); await page.waitForTimeout(900);
  await page.locator("table tbody tr").first().click();
  await page.waitForSelector("#dr-retry");
  await page.screenshot({ path: SHOTS + "/admin-retry.png" });
  await page.click("#dr-retry");
  await page.waitForFunction(() => /Sent/.test(document.querySelector(".drawer .notify-box")?.innerText || ""), null, { timeout: 10000 });
  ok(true, "manual retry from the admin panel delivers the notification");
  await page.click("#dr-close");

  // board + security
  await page.click('#side-nav [data-view="board"]'); await page.waitForTimeout(900);
  ok((await page.locator(".col").count()) === 6, "board has 6 status columns incl. In discussion");
  await page.screenshot({ path: SHOTS + "/admin-board.png" });
  await page.click('#side-nav [data-view="security"]'); await page.waitForSelector(".sec-grid"); await page.waitForTimeout(400);
  await page.screenshot({ path: SHOTS + "/admin-security.png", fullPage: true });
  ok((await page.locator(".sec-grid").innerText()).includes("On"), "security page shows 2FA on, sessions, e-mail status, backup");
  ok((await page.locator(".list-plain").last().innerText()).includes("order.updated"), "activity log lists admin changes");

  // deep link from the e-mail
  const mail = await ctl("/");
  const link = mail.sent.find((x) => /Browser Test Client/.test(x.text)).text.match(/https:\/\/www\.webcreatorsuz\.com(\/admin\/#order=[a-z0-9]+)/)[1];
  await page.goto("about:blank"); await page.goto(BASE + link); await page.waitForSelector(".drawer.open", { timeout: 8000 });
  ok((await page.locator("#dr-name").innerText()) === "Browser Test Client", "admin link in the e-mail opens that order");
  await page.click("#dr-close");

  // mobile admin
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#m-nav [data-view="overview"]'); await page.waitForTimeout(600);
  await page.screenshot({ path: SHOTS + "/admin-mobile.png" });
  ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "admin has no horizontal overflow on mobile");

  // logout invalidates
  const before = (await ctx.cookies()).find((c) => c.name === "__Host-wc_admin").value;
  await page.locator(".mtop [data-logout]").click();
  await page.waitForSelector("#login:not([hidden])");
  const r = await fetch(BASE + "/api/orders", { headers: { Cookie: "__Host-wc_admin=" + before } });
  ok(r.status === 401, "after logout the old session cookie is rejected");
  ok(issues.length === 0, "no CSP violations, JS errors or XSS dialogs in admin" + (issues.length ? ": " + issues.join(" | ") : ""));

  await browser.close();
  for (const [s, n] of results) console.log(s.padEnd(5), n);
  console.log(`\n${results.filter((r) => r[0] === "PASS").length}/${results.length} passed`);
})().catch((e) => { console.error(e); for (const [s, n] of results) console.log(s.padEnd(5), n); process.exit(1); });
