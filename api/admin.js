// Admin security & maintenance (all require a signed-in admin with 2FA).
// GET  /api/admin?section=security   2FA status, active sessions, e-mail/Telegram setup, recent alerts
// GET  /api/admin?section=audit&page=N   audit log, 50 per page
// GET  /api/admin?section=backup     JSON backup of every order and its notification state
// POST /api/admin {action:"test-email"}  sends a test message to ADMIN_NOTIFICATION_EMAIL

const L = require("./_lib");
const A = require("./_auth");
const N = require("./_notify");

const mask = (email) => email.replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + "*".repeat(Math.min(b.length, 6)) + c);
const parseList = (raws) => (raws || []).map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);

module.exports = L.handler(async (req, res) => {
  const s = await A.requireAdmin(req, res);
  if (!s) return;

  if (req.method === "GET") {
    const section = String(L.query(req).section || "security");

    if (section === "security") {
      const [mfa, sessions, alerts, failedIds] = await Promise.all([
        A.getMfa(), A.listSessions(), L.redis("LRANGE", "alerts", "0", "19"), L.redis("ZCARD", "notify:due")
      ]);
      return L.send(res, 200, {
        mfa: { enabled: Boolean(mfa && mfa.enc), enabledAt: mfa?.enabledAt || null, recoveryLeft: mfa?.recovery?.length ?? 0 },
        sessions: sessions.map((x) => ({ current: x.id === s.id, createdAt: x.createdAt, lastSeen: x.lastSeen, country: x.country, city: x.city, ua: x.ua }))
          .sort((a, b) => b.lastSeen - a.lastSeen),
        sessionPolicy: { idleMinutes: A.IDLE_MS / 60000, maxHours: A.ABSOLUTE_MS / 3600000 },
        email: { configured: N.emailConfigured(), to: L.CFG.adminEmails.map(mask), from: L.CFG.mailFrom ? L.CFG.mailFrom.replace(/<.*>/, "").trim() || "set" : "" , provider: "Resend" },
        telegram: { configured: N.telegramConfigured() },
        cron: { configured: Boolean(L.CFG.cronSecret) },
        retryQueue: Number(failedIds) || 0,
        alerts: parseList(alerts)
      });
    }

    if (section === "audit") {
      const page = Math.max(1, parseInt(L.query(req).page, 10) || 1);
      const [raws, total] = await Promise.all([L.redis("LRANGE", "audit", String((page - 1) * 50), String(page * 50 - 1)), L.redis("LLEN", "audit")]);
      return L.send(res, 200, { entries: parseList(raws), page, pages: Math.max(1, Math.ceil(Number(total) / 50)) });
    }

    if (section === "backup") {
      const ids = (await L.redis("ZRANGE", "orders", "0", "-1", "REV")) || [];
      const [orders, notify] = ids.length ? await Promise.all([L.mgetJSON(ids.map((i) => "order:" + i)), L.mgetJSON(ids.map((i) => "notify:" + i))]) : [[], []];
      await L.audit(req, s, "backup.exported", "", { orders: ids.length });
      const body = JSON.stringify({ exportedAt: new Date().toISOString(), orders: orders.map((o, i) => o && { ...o, notifyState: notify[i] }).filter(Boolean) }, null, 2);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", `attachment; filename="webcreators-orders-backup-${new Date().toISOString().slice(0, 10)}.json"`);
      return res.end(body);
    }

    return L.send(res, 400, { error: "unknown_section" });
  }

  if (req.method === "POST") {
    const b = await L.readBody(req, 2000);
    if (b.action === "test-email") {
      if (!N.emailConfigured()) return L.send(res, 400, { error: "email_not_configured" });
      if (!(await L.rateLimit("rl:testmail", 3, 600))) return L.send(res, 429, { error: "too_many_requests" });
      const r = await N.sendEmail({
        subject: "[WebCreators] Test notification",
        text: "This is a test from the WEB-CREATORS admin panel. New-order e-mails will arrive at this address.",
        html: "<p>This is a test from the WEB-CREATORS admin panel. New-order e-mails will arrive at this address.</p>"
      });
      await L.audit(req, s, "notify.test_email", "", { ok: r.ok });
      // Accepted by the provider is not the same as delivered to the inbox; the UI says so.
      return L.send(res, 200, r.ok ? { ok: true, accepted: true } : { ok: false, error: r.error });
    }
    return L.send(res, 400, { error: "unknown_action" });
  }

  return L.send(res, 405, { error: "method_not_allowed" }, { Allow: "GET, POST" });
});
